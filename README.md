# NexCore Labs 🌐

> **Bringing projects to life online — making every idea count.**

NexCore Labs is a creative web development and innovation initiative founded in 2025 at Sultan Qaboos University.  
We provide professional digital solutions and showcase platforms for student-led projects, empowering teams to highlight their core ideas and contributions effectively.

---

## 🚀 Mission

To bring projects to life online, transforming every idea into an impactful digital experience.

## 🌍 Vision

To become the go-to hub for showcasing innovation, connecting creators and audiences worldwide.

---

## 🔒 Progressive Web App (PWA)

NexCore Labs supports offline mode and caching using a custom **Service Worker**.  
Install the app on your desktop or phone for quick access and seamless performance.

---

## 📸 Preview

Visit the live version here:  
👉 [**NexCore Labs**](https://nexcorelabs.vercel.app/)

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.  
Current version: **v2.9.1**

### Release automation

`assets/data/releases.json` is the canonical bilingual release history. Use:

- `npm run release:draft` to create a Gemini-assisted draft.
- `npm run release:generate` to regenerate changelogs and version files.
- `npm run release:validate` to validate release data and version constants.
- `npm run release:check` to verify generated files are current.

The **Draft bilingual release** GitHub workflow opens a review PR from `dev` or another selected branch. It requires the `GEMINI_API_KEY` repository secret and optionally reads the `GEMINI_MODEL` repository variable. After that PR is merged, run **Publish release** from `main` to create the annotated tag and GitHub Release.

---

## 🧭 Author

**NexCore Labs Team**  
_2025 Cohort — Sultan Qaboos University_  

---

> _Progress makes **improvement**, not perfection._
