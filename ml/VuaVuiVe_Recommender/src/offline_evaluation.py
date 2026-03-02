from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import numpy as np
import pandas as pd
from tqdm import tqdm

from utils import read_csv_optimized


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _dcg(relevances: Sequence[int]) -> float:
    # relevances are 0/1
    dcg = 0.0
    for i, rel in enumerate(relevances, start=1):
        if rel:
            dcg += 1.0 / math.log2(i + 1)
    return dcg


def ndcg_at_k(recommended: Sequence[int], ground_truth: Set[int], k: int) -> float:
    if not ground_truth:
        return 0.0
    rec_k = recommended[:k]
    rel = [1 if pid in ground_truth else 0 for pid in rec_k]
    dcg = _dcg(rel)
    ideal_rel = [1] * min(k, len(ground_truth))
    idcg = _dcg(ideal_rel)
    return float(dcg / idcg) if idcg > 0 else 0.0


def precision_at_k(recommended: Sequence[int], ground_truth: Set[int], k: int) -> float:
    if k <= 0:
        return 0.0
    rec_k = recommended[:k]
    hits = sum(1 for pid in rec_k if pid in ground_truth)
    return float(hits / k)


def recall_at_k(recommended: Sequence[int], ground_truth: Set[int], k: int) -> float:
    if not ground_truth:
        return 0.0
    rec_k = recommended[:k]
    hits = sum(1 for pid in rec_k if pid in ground_truth)
    return float(hits / len(ground_truth))


def average_precision_at_k(recommended: Sequence[int], ground_truth: Set[int], k: int) -> float:
    if not ground_truth:
        return 0.0
    rec_k = recommended[:k]
    hits = 0
    s = 0.0
    for i, pid in enumerate(rec_k, start=1):
        if pid in ground_truth:
            hits += 1
            s += hits / i
    denom = min(k, len(ground_truth))
    return float(s / denom) if denom > 0 else 0.0


@dataclass(frozen=True)
class MethodResult:
    name: str
    recommendations: List[int]


class OfflineEvaluator:
    def __init__(
        self,
        project_root: Path,
        *,
        max_users: int = 5000,
        seed_items_per_user: int = 20,
        random_state: int = 42,
        chunksize_prior: int = 1_000_000,
    ):
        self.project_root = Path(project_root)
        self.data_dir = self.project_root / "data" / "01_raw"
        self.features_dir = self.project_root / "data" / "03_features"
        self.viz_dir = self.project_root / "visualizations" / "04_evaluation"

        self.max_users = int(max_users)
        self.seed_items_per_user = int(seed_items_per_user)
        self.random_state = int(random_state)
        self.chunksize_prior = int(chunksize_prior)

        _ensure_dir(self.viz_dir)

        self._load_features()

    def _load_features(self) -> None:
        pop_path = self.features_dir / "popularity.json"
        neigh_path = self.features_dir / "cooccurrence_neighbors.json"

        if not pop_path.exists():
            raise FileNotFoundError(f"Missing features file: {pop_path}")
        if not neigh_path.exists():
            raise FileNotFoundError(f"Missing features file: {neigh_path}")

        with open(pop_path, "r", encoding="utf-8") as f:
            pop = json.load(f)
        # pop["global"] is list[[pid, cnt], ...] (JSON ints)
        self.pop_global: List[Tuple[int, int]] = [(int(pid), int(cnt)) for pid, cnt in pop["global"]]
        self.pop_max: int = max((cnt for _, cnt in self.pop_global), default=1)

        with open(neigh_path, "r", encoding="utf-8") as f:
            neigh_raw = json.load(f)
        # {prod_id: [[neighbor_id, cnt], ...]}
        self.neighbors: Dict[int, List[Tuple[int, int]]] = {
            int(k): [(int(pid), int(cnt)) for pid, cnt in v] for k, v in neigh_raw.items()
        }

    def _load_orders(self) -> pd.DataFrame:
        orders_path = self.data_dir / "orders.csv"
        orders = read_csv_optimized(
            orders_path,
            usecols=["order_id", "user_id", "eval_set", "order_number"],
            dtype={"order_id": np.int32, "user_id": np.int32, "eval_set": "category", "order_number": np.int16},
            reduce_memory=False,
        )
        return orders

    def _load_train_ground_truth(self, train_orders: pd.DataFrame) -> Dict[int, Set[int]]:
        train_path = self.data_dir / "order_products__train.csv"
        train_df = read_csv_optimized(
            train_path,
            usecols=["order_id", "product_id"],
            dtype={"order_id": np.int32, "product_id": np.int32},
            reduce_memory=False,
        )

        df = train_orders[["order_id", "user_id"]].merge(train_df, on="order_id", how="inner")
        gt: Dict[int, Set[int]] = {}
        for user_id, grp in df.groupby("user_id"):
            gt[int(user_id)] = set(map(int, grp["product_id"].tolist()))
        return gt

    def _choose_eval_users(self, gt_by_user: Dict[int, Set[int]]) -> List[int]:
        users = [u for u, gt in gt_by_user.items() if gt]
        rng = np.random.default_rng(self.random_state)
        if self.max_users > 0 and len(users) > self.max_users:
            users = rng.choice(users, size=self.max_users, replace=False).tolist()
        users = sorted(map(int, users))
        return users

    def _build_prior_index_for_users(
        self, orders: pd.DataFrame, eval_users: Set[int]
    ) -> Tuple[Dict[int, int], Dict[int, int]]:
        # Returns:
        # - prior_order_to_user: order_id -> user_id (for users in eval_users)
        # - last_prior_order_id_by_user: user_id -> last prior order_id
        prior = orders[(orders["eval_set"] == "prior") & (orders["user_id"].isin(eval_users))].copy()
        if prior.empty:
            return {}, {}

        # Find last prior order per user by max order_number
        prior.sort_values(["user_id", "order_number"], inplace=True)
        last_rows = prior.groupby("user_id", sort=False).tail(1)
        last_prior_order_id_by_user = {int(r.user_id): int(r.order_id) for r in last_rows.itertuples(index=False)}

        # Map all prior order_ids for these users
        prior_order_to_user = {int(r.order_id): int(r.user_id) for r in prior[["order_id", "user_id"]].itertuples(index=False)}
        return prior_order_to_user, last_prior_order_id_by_user

    def _stream_prior_history(
        self,
        prior_order_to_user: Dict[int, int],
        last_prior_order_id_by_user: Dict[int, int],
    ) -> Tuple[Dict[int, Set[int]], Dict[int, List[int]]]:
        prior_path = self.data_dir / "order_products__prior.csv"
        needed_orders = set(prior_order_to_user.keys())
        if not needed_orders:
            return {}, {}

        history: Dict[int, Set[int]] = {}
        seeds: Dict[int, List[int]] = {}

        # For quick reverse lookup: order_id -> (user_id, is_last)
        last_orders = set(last_prior_order_id_by_user.values())

        reader = pd.read_csv(
            prior_path,
            usecols=["order_id", "product_id"],
            dtype={"order_id": np.int32, "product_id": np.int32},
            chunksize=self.chunksize_prior,
        )

        for chunk in tqdm(reader, desc="Streaming prior interactions", unit="rows"):
            # Filter to needed order_ids (vectorized)
            mask = chunk["order_id"].isin(needed_orders)
            if not mask.any():
                continue

            sub = chunk.loc[mask, ["order_id", "product_id"]]
            for order_id, product_id in sub.itertuples(index=False):
                uid = prior_order_to_user.get(int(order_id))
                if uid is None:
                    continue
                pid = int(product_id)
                history.setdefault(uid, set()).add(pid)

                if int(order_id) in last_orders:
                    s = seeds.setdefault(uid, [])
                    if len(s) < self.seed_items_per_user:
                        s.append(pid)

        return history, seeds

    def _recommend_popularity(self, history: Set[int], n: int) -> List[int]:
        recs: List[int] = []
        for pid, _cnt in self.pop_global:
            if pid in history:
                continue
            recs.append(pid)
            if len(recs) >= n:
                break
        return recs

    def _recommend_cooccurrence(self, seed_items: Sequence[int], history: Set[int], n: int) -> List[int]:
        scores: Dict[int, float] = {}
        seed_set = set(map(int, seed_items))

        for seed in seed_items:
            neigh = self.neighbors.get(int(seed), [])
            for nid, cnt in neigh[:200]:
                if nid in history or nid in seed_set:
                    continue
                scores[nid] = scores.get(nid, 0.0) + float(math.log1p(cnt))

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [pid for pid, _ in ranked[:n]]

    def _recommend_hybrid(self, seed_items: Sequence[int], history: Set[int], n: int, w_basket: float = 0.7, w_pop: float = 0.3) -> List[int]:
        scores: Dict[int, float] = {}
        seed_set = set(map(int, seed_items))

        # Basket component
        for seed in seed_items:
            for nid, cnt in self.neighbors.get(int(seed), [])[:200]:
                if nid in history or nid in seed_set:
                    continue
                scores[nid] = scores.get(nid, 0.0) + w_basket * float(math.log1p(cnt))

        # Popular component
        for pid, cnt in self.pop_global[:2000]:
            if pid in history or pid in seed_set:
                continue
            scores[pid] = scores.get(pid, 0.0) + w_pop * (float(cnt) / float(self.pop_max))

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [pid for pid, _ in ranked[:n]]

    def evaluate(self, ks: Sequence[int] = (5, 10, 20)) -> pd.DataFrame:
        orders = self._load_orders()

        train_orders = orders[orders["eval_set"] == "train"]["order_id user_id".split()].copy()
        gt_by_user = self._load_train_ground_truth(train_orders)
        eval_users = self._choose_eval_users(gt_by_user)
        eval_users_set = set(eval_users)

        prior_order_to_user, last_prior_order_id_by_user = self._build_prior_index_for_users(orders, eval_users_set)
        history_by_user, seeds_by_user = self._stream_prior_history(prior_order_to_user, last_prior_order_id_by_user)

        max_k = int(max(ks))

        rows: List[Dict[str, object]] = []
        for user_id in tqdm(eval_users, desc="Evaluating users"):
            gt = gt_by_user.get(user_id, set())
            if not gt:
                continue

            history = history_by_user.get(user_id, set())
            seeds = seeds_by_user.get(user_id, [])

            # If no seeds, fallback to a small subset from history
            if not seeds and history:
                seeds = list(sorted(history))[: min(self.seed_items_per_user, len(history))]

            methods = [
                ("popularity", self._recommend_popularity(history, n=max_k)),
                ("cooccurrence", self._recommend_cooccurrence(seeds, history, n=max_k) if seeds else self._recommend_popularity(history, n=max_k)),
                ("hybrid", self._recommend_hybrid(seeds, history, n=max_k) if seeds else self._recommend_popularity(history, n=max_k)),
            ]

            for method_name, recs in methods:
                base = {
                    "user_id": int(user_id),
                    "method": method_name,
                    "gt_size": int(len(gt)),
                    "history_size": int(len(history)),
                    "seed_size": int(len(seeds)),
                }
                for k in ks:
                    base[f"precision@{k}"] = precision_at_k(recs, gt, int(k))
                    base[f"recall@{k}"] = recall_at_k(recs, gt, int(k))
                    base[f"ndcg@{k}"] = ndcg_at_k(recs, gt, int(k))
                    base[f"map@{k}"] = average_precision_at_k(recs, gt, int(k))

                rows.append(base)

        df = pd.DataFrame(rows)
        return df

    def summarize(self, df: pd.DataFrame, ks: Sequence[int]) -> pd.DataFrame:
        metric_cols = []
        for k in ks:
            metric_cols += [f"precision@{k}", f"recall@{k}", f"ndcg@{k}", f"map@{k}"]

        summary = df.groupby("method")[metric_cols].agg(["mean", "std"]).reset_index()
        return summary

    def export_plots(self, df: pd.DataFrame, ks: Sequence[int]) -> None:
        import matplotlib.pyplot as plt
        import seaborn as sns

        sns.set_style("whitegrid")

        # 1) Barplots: mean metrics by method for each K
        metric_families = [
            ("precision", [f"precision@{k}" for k in ks]),
            ("recall", [f"recall@{k}" for k in ks]),
            ("ndcg", [f"ndcg@{k}" for k in ks]),
            ("map", [f"map@{k}" for k in ks]),
        ]

        for family, cols in metric_families:
            melted = df.melt(id_vars=["method"], value_vars=cols, var_name="metric", value_name="value")
            plt.figure(figsize=(12, 5))
            ax = sns.barplot(data=melted, x="metric", y="value", hue="method", errorbar=("ci", 95))
            ax.set_title(f"{family.upper()} by method (95% CI)")
            ax.set_xlabel("K")
            ax.set_ylabel(family)
            plt.tight_layout()
            out = self.viz_dir / f"01_{family}_by_method.png"
            plt.savefig(out, dpi=160, bbox_inches="tight")
            plt.close()

        # 2) Coverage@K curves
        plt.figure(figsize=(10, 5))
        for method in sorted(df["method"].unique()):
            sub = df[df["method"] == method]
            # Recompute coverage by re-running recommendation lists is expensive.
            # Instead, approximate coverage using top-K of popularity list across users is not possible here.
            # So we plot a proxy: average history_size and gt_size per method.
            # (Still useful for report context.)
            pass
        plt.close()

        # 3) Per-user recall distribution at K=max(ks)
        k = int(max(ks))
        col = f"recall@{k}"
        plt.figure(figsize=(10, 5))
        ax = sns.histplot(data=df, x=col, hue="method", bins=30, kde=True, element="step")
        ax.set_title(f"Per-user {col} distribution")
        plt.tight_layout()
        out = self.viz_dir / f"02_recall_distribution_k{k}.png"
        plt.savefig(out, dpi=160, bbox_inches="tight")
        plt.close()

        # 4) Dataset stats
        plt.figure(figsize=(10, 4))
        stats = df[["user_id", "history_size", "seed_size", "gt_size", "method"]].copy()
        stats = stats.drop_duplicates(subset=["user_id", "method"])
        ax = sns.boxplot(data=stats, x="method", y="history_size")
        ax.set_title("History size distribution (by method / identical users)")
        plt.tight_layout()
        out = self.viz_dir / "03_history_size_boxplot.png"
        plt.savefig(out, dpi=160, bbox_inches="tight")
        plt.close()

    def save_outputs(self, df: pd.DataFrame, ks: Sequence[int]) -> None:
        # Raw per-user metrics
        df_path = self.viz_dir / "per_user_metrics.csv"
        df.to_csv(df_path, index=False)

        # Summary table
        summary = self.summarize(df, ks)
        summary_path = self.viz_dir / "metrics_summary.csv"
        summary.to_csv(summary_path, index=False)

        # Also a compact JSON with mean metrics
        means: Dict[str, Dict[str, float]] = {}
        for method, sub in df.groupby("method"):
            means[method] = {f"{m}@{k}": float(sub[f"{m}@{k}"].mean()) for m in ["precision", "recall", "ndcg", "map"] for k in ks}
        with open(self.viz_dir / "metrics_summary.json", "w", encoding="utf-8") as f:
            json.dump(
                {
                    "ks": list(map(int, ks)),
                    "n_users": int(df["user_id"].nunique()) if not df.empty else 0,
                    "methods": means,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Offline evaluation for recommender (Instacart train split)")
    parser.add_argument("--project-root", type=str, default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--max-users", type=int, default=5000)
    parser.add_argument("--seed-items", type=int, default=20)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--chunksize-prior", type=int, default=1_000_000)
    parser.add_argument("--ks", type=str, default="5,10,20")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ks = tuple(int(x.strip()) for x in args.ks.split(",") if x.strip())

    evaluator = OfflineEvaluator(
        Path(args.project_root),
        max_users=args.max_users,
        seed_items_per_user=args.seed_items,
        random_state=args.random_state,
        chunksize_prior=args.chunksize_prior,
    )

    df = evaluator.evaluate(ks=ks)
    evaluator.save_outputs(df, ks)
    evaluator.export_plots(df, ks)

    print(f"\n✓ Done. Outputs saved to: {evaluator.viz_dir}")
    if not df.empty:
        print(f"Users evaluated: {df['user_id'].nunique()} (rows={len(df)})")
        print(df.groupby('method')[[f'recall@{max(ks)}', f'ndcg@{max(ks)}']].mean().round(4))


if __name__ == "__main__":
    main()
