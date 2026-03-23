# VuaVuiVe Project Sitemap (English)

## 1) Client/Customer Sitemap

```mermaid
flowchart TD
  ROOT[Customer Portal :4200]

  ROOT --> HOME[/]
  ROOT --> PRODUCTS[/products]
  ROOT --> AUTH[/auth]
  ROOT --> CHECKOUT[/checkout]
  ROOT --> ORDERS[/orders]
  ROOT --> ACCOUNT[/account]
  ROOT --> RECOMMENDED[/recommended]
  ROOT --> RECIPES[/recipes]
  ROOT --> ABOUT[/about]
  ROOT --> ABOUT2[/about2]
  ROOT --> CART[/cart]
  ROOT --> JOB[/job]
  ROOT --> NEWS[/news]

  PRODUCTS --> PRODUCT_DETAIL[/products/:id]

  AUTH --> LOGIN[/auth/login]
  AUTH --> REGISTER[/auth/register]
  AUTH --> FORGOT_PASSWORD[/auth/forgot-password]

  CHECKOUT --> VNPAY_RETURN[/checkout/return]
  CHECKOUT --> MOMO_RETURN[/checkout/momo-return]

  ORDERS --> ORDER_DETAIL[/orders/:id]
```

## 2) Admin Sitemap

```mermaid
flowchart TD
  ADMIN_ROOT[Admin Portal :4201]

  ADMIN_ROOT --> ADMIN_LOGIN[/auth/login]
  ADMIN_ROOT --> ADMIN_DASHBOARD[/dashboard]
  ADMIN_ROOT --> ADMIN_PRODUCTS[/products]
  ADMIN_ROOT --> ADMIN_ORDERS[/orders]
  ADMIN_ROOT --> ADMIN_USERS[/users]
  ADMIN_ROOT --> ADMIN_VOUCHERS[/vouchers]
  ADMIN_ROOT --> ADMIN_REPORTS[/reports]
  ADMIN_ROOT --> ADMIN_ML[/ml-insights]
  ADMIN_ROOT --> ADMIN_AUDIT[/audit]
```

## 3) Access Rules (Summary)

- Customer public pages:
  - `/`, `/products`, `/products/:id`, `/recommended`, `/recipes`, `/about`, `/about2`, `/cart`, `/job`, `/news`
- Customer guest-only pages:
  - `/auth/login`, `/auth/register`
- Customer auth-required pages:
  - `/checkout`, `/orders`, `/orders/:id`, `/account`
- Admin-only area (guarded):
  - Admin layout and all child routes: `/dashboard`, `/products`, `/orders`, `/users`, `/vouchers`, `/reports`, `/ml-insights`, `/audit`

## 4) Compact Tree View

```text
Customer Portal Root (:4200)
/
|-- (home)
|-- products
|   |-- :id
|-- auth
|   |-- login
|   |-- register
|   |-- forgot-password
|-- checkout
|   |-- return
|   |-- momo-return
|-- orders
|   |-- :id
|-- account
|-- recommended
|-- recipes
|-- about
|-- about2
|-- cart
|-- job
|-- news

Admin Portal Root (:4201)
|-- auth/login
|-- dashboard
|-- products
|-- orders
|-- users
|-- vouchers
|-- reports
|-- ml-insights
|-- audit
```
