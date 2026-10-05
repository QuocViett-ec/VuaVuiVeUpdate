# Traceability

| Requirement | Cases | Automation/source evidence | Bugs |
|---|---|---|---|
| R01 | TC01,TC02 | order-rules.test.js; orders.integration.test.js | B01 |
| R02,R03 | TC03–TC07 | orders.integration.test.js | B02 |
| R04,R05 | TC08,TC09,TC19 | security.test.js; orders.integration.test.js | B03 |
| R06,R07 | TC10,TC11,TC20 | payment-availability.test.js; payment.test.js; integration | B04 |
| R08–R12 | TC12–TC15,TC19,TC20 | order-rules + orders.integration; order/shipment lifecycle | B05 |
| R13,R14 | TC16 | integration; product-card/product-list; recommend proxy | B06 |
| R15,R16 | TC17,TC21 | security.test.js signatures/log/seed; Playwright checkout | B07 |
| R17 | TC18,TC22 | restore-drill.cjs; ops/production.md | GATE restore staging |
| R18 | All | workflow quality.yml; local summary; release-gates | GATE CI/production |
| R19 | TC23,TC24 | ops/tests/release.test.cjs; release.yml; CICD report | GATE hosting/production |
| R20 | TC25,TC26 | runtime config and admin Playwright; admin build/package; CICD report | B08,B09 |
| R21 | TC27,TC28 | deployment.test.js; test_wsgi_runtime.py; 2026-10-05 report | GATE staging cloud/model |

Execution local nằm trong [summary](2026-10-04-summary.md). Test case manual ghi Not Run dù testcase tương ứng có automation một phần. Bugs sản phẩm đã sửa cần regression staging trước khi coi closed trên production.

Execution CI/CD tiếp theo nằm trong [CI/CD report](2026-10-04-cicd.md); giữ riêng kết quả local và cloud Not Run.
