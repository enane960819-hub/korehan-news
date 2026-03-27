# korehan-news

Korehan static site is connected to **Cloudflare Pages (GitHub integration)**.

## Auto deployment

Any change pushed to `main` is automatically built and deployed by Cloudflare Pages.

- GitHub repo: `enane960819-hub/korehan-news`
- Production branch: `main`
- Production domains:
  - `https://korehannews.com`
  - `https://www.korehannews.com`
- Pages subdomain: `https://korehan-news.pages.dev`

## Manual deploy (optional)

```bash
npx wrangler pages deploy korehan --project-name korehan-news --branch main
```
