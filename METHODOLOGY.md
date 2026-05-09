# PART 3: METHODOLOGY

## 3.1 Research Design

<!-- ADDED -->

Real-world grocery recommendation is constrained by highly sparse user-item interactions, continuously changing purchase behavior, and the absence of explicit rating labels in most transactions.

<!-- ADDED -->

These factors make preference learning difficult because the system must infer intent from implicit behavioral traces under non-stationary conditions.

This study follows an applied machine learning research design to develop a user-centric grocery platform with integrated product recommendation. The design objective is to support realistic shopping behavior, where users show different history lengths, changing intent, and non-uniform interaction density. A single recommendation method is not sufficient for this setting. Therefore, a hybrid recommendation strategy is adopted to combine personalization and robustness in one production pipeline.

The methodology is aligned with established recommender-system principles that combine collaborative preference learning with behavioral context signals (Ricci et al., 2011; Hu, Koren, & Volinsky, 2008). The complete workflow includes data preparation, feature engineering, model training, offline evaluation, and service-level deployment. In implementation terms, collaborative filtering is used to capture latent preference structure, basket co-occurrence is used to model short-term purchase context, and popularity is used as a stable fallback signal.

The main contribution of this methodology lies in the practical integration of an offline implicit-feedback recommender with an online grocery platform through a domain-mapping adapter, recency-aware preference reweighting, and diversity-controlled ranking. This contribution is methodological because it addresses the common gap between offline recommendation accuracy and deployment reliability under cold-start and sparse-history conditions.

<!-- ADDED -->

Compared with pure collaborative filtering, which can degrade under sparse histories, and pure popularity ranking, which tends to over-generalize user needs, the proposed hybrid design provides a more balanced relevance-robustness trade-off.

## 3.2 Data Collection and Description

Two linked data sources are used in this project. The first source is the Instacart transaction dataset stored in CSV files, including orders, products, aisles, departments, prior-order lines, and train-order lines. Based on generated artifacts and logged matrix dimensions, the data scale is approximately 206,209 users and 49,677 products, with more than three million prior orders and separate train and test partitions. The `eval_set` variable in the orders table (`prior`, `train`, `test`) is central to the evaluation protocol.

<!-- ADDED -->

At this scale, the user-item matrix is inherently sparse, which is a core data characteristic that motivates the use of latent factorization and fallback ranking signals.

The second source is the platform dataset in JSON format, containing product catalog records, user profiles, and order histories from the deployed grocery system. These records include product identifiers, names, prices, images, category labels, order statuses, item quantities, and identity hints such as email, name, and phone. This source is consumed by a dedicated adapter to map platform entities to the recommendation model domain and back to platform-native outputs.

The learning setting is implicit-feedback recommendation, where observed interactions indicate preference strength without explicit ratings (Hu, Koren, & Volinsky, 2008). Key variables include `user_id`, `product_id`, `order_id`, purchase quantity, order sequence/time fields, and taxonomy fields (department, aisle, category, subcategory). Interaction frequency is treated as behavioral signal intensity rather than direct utility score.

## 3.3 Data Preprocessing

Preprocessing is implemented through notebooks and reusable utilities to ensure reproducibility. Raw files are loaded with explicit compact data types, such as int32, int16, int8, and categorical encoding for split labels, to reduce memory usage and support large-table processing. A downcasting routine is applied to numeric columns when value ranges allow smaller representations.

Data cleaning includes structural consistency checks and duplicate diagnostics. Duplicate `order_id` entries are checked in the orders table, and duplicate (`order_id`, `product_id`) pairs are checked in prior and train interaction tables before feature construction. Missing values in temporal fields are handled explicitly. In particular, `days_since_prior_order` is imputed with a sentinel value and recast to a consistent floating-point format so that downstream operations are deterministic.

<!-- ADDED -->

In addition, low-signal interactions are reduced during resource-aware processing by prioritizing active-user subsets for dense factorization, which helps suppress noise from extremely weak histories without changing the main artifact definitions.

Processed tables are exported to Parquet for efficient reload and reproducible experiments. No global z-score normalization or min-max scaling is applied to interaction counts because the recommender consumes non-negative implicit frequencies. In resource-constrained training conditions, activity-based user sampling is applied as computational filtering, not as permanent data removal, to preserve methodological consistency between offline preparation and deployment artifacts.

## 3.4 Feature Engineering

Feature engineering is divided into three core offline artifacts and one online behavioral layer. First, a sparse user-item interaction matrix is built from prior transactions, where each matrix entry represents purchase frequency for a user-product pair. ID-index mappings are stored so that model factors and runtime lookup remain consistent.

Second, co-occurrence neighbor features are derived from basket-level product sets. Pairwise co-purchase counts are computed inside each order, then sorted to retain top neighbors per product. This creates local context signals that represent near-term shopping intent and complementarity between products.

Third, popularity features are computed as global purchase-frequency rankings, with additional grouped views by department. These features represent global demand priors and provide fallback recommendations when user-specific evidence is weak.

In this architecture, global and local signals are intentionally separated. Popularity and latent factors provide broad global structure, while co-occurrence and recency-aware user profiles provide local context. At runtime, online features are derived from platform order history using quantity-weighted and time-decayed aggregation, then injected into post-mapping ranking to preserve user-centric relevance.

## 3.5 Machine Learning Models

The recommender follows a hybrid architecture with three components: Non-negative Matrix Factorization (NMF), basket co-occurrence ranking, and popularity baseline. NMF is used as the latent collaborative model for implicit data. Given interaction matrix $R$, the model approximates:

$$
R \approx W H
$$

where $W$ contains user latent factors and $H$ contains item latent factors under non-negativity constraints. For a target user, collaborative scores are estimated by latent-vector similarity through matrix multiplication.

The co-occurrence model captures association strength between products that appear in the same basket. Neighbor scores are aggregated over cart or seed items, using logarithmic count transformation to stabilize extreme frequencies. The popularity model provides a frequency-based prior from global purchase counts and ensures robust fallback behavior.

Final ranking uses weighted score fusion:

$$
S(p) = w_{cf} S_{cf}(p) + w_{basket} S_{basket}(p) + w_{pop} S_{pop}(p)
$$

where weights are exposed as runtime parameters and tuned empirically for deployment behavior. In the current API defaults for mapped platform requests, basket and popularity signals receive higher emphasis, while collaborative filtering remains available when enabled.

<!-- ADDED -->

NMF also offers a practical interpretability trade-off, because latent dimensions can be inspected as compressed preference patterns even though they are less directly explainable than rule-based item associations.

This model design follows common hybrid-recommender rationale, where complementary signals are combined to improve robustness (Ricci et al., 2011). Its known limitations are also consistent with recommender literature: sparse user histories reduce latent-model coverage, and cold-start users rely heavily on non-personalized priors. These limitations are mitigated, but not fully removed, by fallback and mapping mechanisms.

## 3.6 Model Training

Model training is executed after offline features are generated. The NMF model is trained with fixed hyperparameters (`n_components = 64`, `init = nndsvda`, `max_iter = 200`, `random_state = 42`) to ensure reproducibility across runs. The fitted user and item factors, together with metadata and model object, are serialized into reusable runtime artifacts.

The training data logic follows the dataset split semantics. Historical `prior` interactions are used to construct the interaction matrix and derive recommendation signals, while `train` interactions are used as evaluation ground truth in the offline evaluator. This separation supports an unbiased ranking-quality estimate for methods compared under identical user subsets.

<!-- ADDED -->

Therefore, model parameter learning is performed on interaction history, whereas ranking performance is assessed on a disjoint supervision slice, reducing leakage between fitting and evaluation.

Because the interaction space is highly sparse and large, a resource-aware training branch is implemented. When matrix dimensionality exceeds a configured threshold, highly active users are sampled to form a dense subset before factorization. This procedure is a computational adaptation that allows training to complete in constrained environments while retaining representative high-signal interactions.

## 3.7 Evaluation Metrics

Offline evaluation compares popularity, co-occurrence, and hybrid methods under the same user-level protocol. For each evaluated user, historical interactions are used to build seeds and history constraints, and held-out relevant items are used as ground truth. Metrics are computed at $K \in \{5, 10, 20\}$ and then aggregated across users.

Precision@K and Recall@K are used to measure relevance concentration and retrieval completeness, respectively. NDCG@K is used to evaluate rank quality by discounting lower-ranked hits, and MAP@K is used to summarize precision over hit positions in the top-K list. These ranking metrics are appropriate for implicit-feedback recommendation where ordered suggestion quality is more meaningful than classification accuracy.

<!-- ADDED -->

All reported method scores are aggregated across users under a ranking-based offline protocol, so conclusions reflect average retrieval behavior rather than isolated individual cases.

The evaluator exports per-user metric files, method-level summary tables with mean and standard deviation, and visual diagnostics with confidence intervals. Averaging across users is used to provide method-level comparability and reduce sensitivity to individual user variance.

## 3.8 Recommendation System Design

The online recommendation pipeline follows five stages: identity resolution, behavioral feature extraction, candidate generation, ranking and post-processing, and response construction. A request first provides user identity and control parameters. The API resolves user history using available identifiers and retrieves valid order interactions. If no usable history exists, popularity-based recommendations are returned as cold-start output.

For users with history, temporal weighting is applied so recent behavior has stronger influence:

$$
w_{time} = e^{-d/\tau}
$$

where $d$ is days since interaction and $\tau$ is the recency decay horizon. Quantity and recency weights are combined to form preference intensity before domain mapping.

A mapping layer then projects platform products into proxy products used by the trained model. Hybrid scoring is computed from collaborative, basket, and popularity components, after which results are mapped back to platform products. Final ranking applies category-preference boosting, optional purchased-item filtering, and diversity control through root-level caps and minimum root coverage. This design provides a practical balance between relevance, novelty, and catalog variety.

## 3.9 System Architecture

The system is deployed as a three-tier architecture. The frontend layer (Angular) requests recommendations through application services and renders multiple recommendation sections. The backend layer (Node.js/Express) exposes recommendation endpoints, proxies requests to the ML service with timeout safeguards, stores recommendation history, and records interaction events. The ML layer (Flask) loads model artifacts and feature resources, executes ranking logic, and serves recommendation APIs.

Operational robustness is achieved through explicit fallback behavior. If the ML service is unavailable or times out, the backend returns local fallback recommendations from active inventory. The adapter in the ML layer supports data reload on source changes, allowing near-real-time adaptation to updated product or order JSON files without full service restart.

Telemetry and feedback signals are integrated through event logging and recommendation-history persistence. Frontend actions such as impressions, clicks, and add-to-cart events are recorded via backend telemetry routes, enabling section-level performance analysis and supporting future iterative optimization.

<!-- ADDED -->

For scalability, the same architecture can be extended with distributed feature refresh and incremental model updates so that latency remains stable as catalog size and traffic increase.

<!-- ADDED -->

Future work may incorporate online learning or reinforcement-style re-ranking from live feedback streams to improve long-term personalization while preserving current reliability constraints.
