"""
Rebuild local recommender artifacts from exported VuaVuiVe backoffice JSON data.

Expected input:
  d:/VUAVUIVE/backoffice/data/products.json
  d:/VUAVUIVE/backoffice/data/orders.json
  d:/VUAVUIVE/backoffice/data/users.json

Outputs:
  ml/VuaVuiVe_Recommender/models/nmf_model.pkl
  ml/VuaVuiVe_Recommender/data/03_features/cf_mappings.json
  ml/VuaVuiVe_Recommender/data/03_features/user_item_matrix.npz
  ml/VuaVuiVe_Recommender/data/03_features/cooccurrence_neighbors.json
  ml/VuaVuiVe_Recommender/data/03_features/popularity.json
"""

from __future__ import annotations

import json
import math
import pickle
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List

import numpy as np
from scipy.sparse import csr_matrix, save_npz
from sklearn.decomposition import NMF


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FEATURES_DIR = PROJECT_ROOT / "data" / "03_features"
MODELS_DIR = PROJECT_ROOT / "models"
MAPPING_FILE = PROJECT_ROOT / "mappings" / "vvv_instacart_mapping.json"
VVV_DATA_DIR = PROJECT_ROOT.parents[2] / "backoffice" / "data"


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_dirs() -> None:
    FEATURES_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)


def category_key(product: Dict) -> str:
    category = str(product.get("category", "other")).strip().casefold() or "other"
    subcategory = str(product.get("subcategory", "all")).strip().casefold() or "all"
    return f"{category}/{subcategory}"


def pick_instacart_ids(vvv_product_id: str, instacart_candidates: Iterable[int]) -> List[int]:
    uniq = list(dict.fromkeys(int(x) for x in instacart_candidates))
    if not uniq:
        return []

    try:
        base = int(str(vvv_product_id).strip())
    except Exception:
        base = sum(ord(c) for c in str(vvv_product_id))

    count = 2 if len(uniq) >= 2 else 1
    step = 7
    return [uniq[(base + i * step) % len(uniq)] for i in range(count)]


def build_proxy_catalog(products: List[Dict], mapping_data: Dict) -> Dict[str, List[int]]:
    category_to_instacart = mapping_data["category_to_instacart"]
    proxy_catalog: Dict[str, List[int]] = {}

    for product in products:
        vvv_id = str(product["id"])
        cat_key = category_key(product)
        candidates = category_to_instacart.get(cat_key, [])

        if not candidates:
            root = cat_key.split("/")[0]
            pooled: List[int] = []
            for key, ids in category_to_instacart.items():
                if key.startswith(f"{root}/"):
                    pooled.extend(int(x) for x in ids)
            candidates = pooled

        proxy_catalog[vvv_id] = pick_instacart_ids(vvv_id, candidates)

    return proxy_catalog


def valid_order(order: Dict) -> bool:
    status = str(order.get("status", "")).strip().lower()
    payment_status = str(order.get("payment_status", "")).strip().lower()
    if status in {"cancelled", "canceled", "failed", "returned", "refunded"}:
        return False
    if payment_status in {"failed", "cancelled", "canceled"}:
        return False
    return bool(order.get("items"))


def build_training_rows(
    orders: List[Dict],
    proxy_catalog: Dict[str, List[int]],
) -> tuple[List[str], Dict[str, Counter], Counter, Dict[int, Counter]]:
    rows_by_user: Dict[str, Counter] = defaultdict(Counter)
    popularity = Counter()
    neighbor_counts: Dict[int, Counter] = defaultdict(Counter)

    for order in orders:
        if not valid_order(order):
            continue

        user_key = str(order.get("userId") or "")
        if not user_key:
            continue

        basket_items: List[int] = []
        for item in order.get("items", []):
            vvv_product_id = str(item.get("productId") or "")
            if not vvv_product_id:
                continue

            proxies = proxy_catalog.get(vvv_product_id, [])
            if not proxies:
                continue

            try:
                qty = int(item.get("quantity", 1))
            except Exception:
                qty = 1
            qty = max(1, min(qty, 20))

            for proxy_id in proxies:
                rows_by_user[user_key][proxy_id] += qty
                popularity[proxy_id] += qty
                basket_items.append(proxy_id)

        unique_basket = sorted(set(basket_items))
        for left in unique_basket:
            for right in unique_basket:
                if left == right:
                    continue
                neighbor_counts[left][right] += 1

    return list(rows_by_user.keys()), rows_by_user, popularity, neighbor_counts


def build_sparse_matrix(user_keys: List[str], rows_by_user: Dict[str, Counter]) -> tuple[csr_matrix, Dict[int, int], Dict[int, int]]:
    product_ids = sorted({pid for counts in rows_by_user.values() for pid in counts.keys()})
    if not user_keys or not product_ids:
        raise RuntimeError("Not enough interactions to build recommender artifacts")

    numeric_user_ids = {user_key: idx + 1 for idx, user_key in enumerate(user_keys)}
    user2idx = {numeric_user_ids[user_key]: idx for idx, user_key in enumerate(user_keys)}
    prod2idx = {product_id: idx for idx, product_id in enumerate(product_ids)}

    data = []
    row_ind = []
    col_ind = []
    for row_idx, user_key in enumerate(user_keys):
        counts = rows_by_user[user_key]
        for product_id, value in counts.items():
            row_ind.append(row_idx)
            col_ind.append(prod2idx[product_id])
            data.append(float(value))

    matrix = csr_matrix(
        (np.array(data, dtype=np.float32), (row_ind, col_ind)),
        shape=(len(user_keys), len(product_ids)),
        dtype=np.float32,
    )
    return matrix, user2idx, prod2idx


def train_nmf(matrix: csr_matrix):
    dense = matrix.toarray()
    n_users, n_items = dense.shape
    n_components = max(1, min(12, n_users, n_items))

    model = NMF(
        n_components=n_components,
        init="nndsvda" if n_components < min(n_users, n_items) else "random",
        random_state=42,
        max_iter=500,
        solver="cd",
    )
    user_factors = model.fit_transform(dense)
    item_factors = model.components_.T
    return model, user_factors, item_factors


def save_artifacts(
    matrix: csr_matrix,
    user2idx: Dict[int, int],
    prod2idx: Dict[int, int],
    popularity: Counter,
    neighbor_counts: Dict[int, Counter],
    model,
    user_factors: np.ndarray,
    item_factors: np.ndarray,
) -> None:
    idx2user = {idx: user_id for user_id, idx in user2idx.items()}
    idx2prod = {idx: product_id for product_id, idx in prod2idx.items()}

    save_npz(FEATURES_DIR / "user_item_matrix.npz", matrix)

    with open(FEATURES_DIR / "cf_mappings.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "user2idx": {str(k): int(v) for k, v in user2idx.items()},
                "prod2idx": {str(k): int(v) for k, v in prod2idx.items()},
                "idx2user": {str(k): int(v) for k, v in idx2user.items()},
                "idx2prod": {str(k): int(v) for k, v in idx2prod.items()},
            },
            f,
            ensure_ascii=True,
            indent=2,
        )

    with open(FEATURES_DIR / "cooccurrence_neighbors.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                str(product_id): [
                    [int(neighbor_id), int(score)]
                    for neighbor_id, score in counts.most_common(50)
                ]
                for product_id, counts in neighbor_counts.items()
            },
            f,
            ensure_ascii=True,
            indent=2,
        )

    global_popularity = [[int(product_id), int(score)] for product_id, score in popularity.most_common(200)]
    by_department: Dict[str, List[List[int]]] = {}
    with open(FEATURES_DIR / "popularity.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "global": global_popularity,
                "by_department": by_department,
            },
            f,
            ensure_ascii=True,
            indent=2,
        )

    with open(MODELS_DIR / "nmf_model.pkl", "wb") as f:
        pickle.dump(
            {
                "model": model,
                "user_factors": user_factors,
                "item_factors": item_factors,
                "metadata": {
                    "domain": "instacart_proxy_from_vvv",
                    "n_users": int(matrix.shape[0]),
                    "n_items": int(matrix.shape[1]),
                    "nnz": int(matrix.nnz),
                },
            },
            f,
        )


def main() -> None:
    ensure_dirs()

    products_path = VVV_DATA_DIR / "products.json"
    orders_path = VVV_DATA_DIR / "orders.json"
    users_path = VVV_DATA_DIR / "users.json"
    for path in [products_path, orders_path, users_path, MAPPING_FILE]:
        if not path.exists():
            raise FileNotFoundError(f"Missing required input: {path}")

    products = load_json(products_path)
    orders = load_json(orders_path)
    _users = load_json(users_path)
    mapping_data = load_json(MAPPING_FILE)

    proxy_catalog = build_proxy_catalog(products, mapping_data)
    user_keys, rows_by_user, popularity, neighbor_counts = build_training_rows(
        orders,
        proxy_catalog,
    )

    matrix, user2idx, prod2idx = build_sparse_matrix(user_keys, rows_by_user)
    model, user_factors, item_factors = train_nmf(matrix)

    save_artifacts(
        matrix,
        user2idx,
        prod2idx,
        popularity,
        neighbor_counts,
        model,
        user_factors,
        item_factors,
    )

    print(
        f"Built local ML artifacts: users={matrix.shape[0]}, items={matrix.shape[1]}, nnz={matrix.nnz}"
    )
    print(f"Saved model -> {MODELS_DIR / 'nmf_model.pkl'}")
    print(f"Saved features -> {FEATURES_DIR}")


if __name__ == "__main__":
    main()
