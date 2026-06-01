# Contributing to PATHOSIM

Thank you for your interest in contributing to PATHOSIM — Global Epidemic Intelligence System. This document outlines the process for contributing bug reports, feature requests, and code changes.

---

## Code of Conduct

Be respectful, constructive, and professional. This is a scientific modelling project — critique models and code, not people.

---

## Reporting Bugs

Open a GitHub Issue with:

1. **Environment** — OS, browser and version, Python version
2. **Steps to reproduce** — minimal, clear reproduction steps
3. **Expected vs. actual behaviour**
4. **Console output / screenshots** if relevant

---

## Suggesting Enhancements

Open a GitHub Issue tagged `enhancement`. Include:

- Scientific justification (cite literature where applicable)
- Description of the proposed change to the epidemiological model or UI
- Any known limitations or trade-offs of the approach

---

## Development Setup

```bash
git clone https://github.com/your-org/pathosim.git
cd pathosim/webapp
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
cp .env.example .env         # add your Anthropic API key
python app.py
```

---

## Pull Request Guidelines

1. **Fork** the repository and create a branch: `git checkout -b feat/your-feature`
2. **Write clear commit messages** following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new features
   - `fix:` — bug fixes
   - `docs:` — documentation only
   - `refactor:` — code restructuring without behaviour change
   - `perf:` — performance improvements
   - `chore:` — maintenance, build, deps
3. **Test your changes** across Chrome, Firefox, and Safari
4. **Document** any new epidemiological parameters or model changes in `README.md`
5. **Open a PR** against `main` with a clear description of the change and its scientific motivation

---

## Model Contribution Guidelines

Changes to the SEIR engine (`computeAllSnapshots`, `travelWeight`, `haversine`) must:

- Maintain **backward compatibility** with the existing parameter API
- Include a reference to the epidemiological literature motivating the change
- Not break the O(N²) per-day computational complexity target for real-time performance

---

## Areas Where Contributions Are Especially Welcome

| Area | Description |
|------|-------------|
| **Stochastic SEIR** | Gillespie algorithm for small-population extinction modelling |
| **Age stratification** | POLYMOD contact matrix integration |
| **NPI parameters** | Lockdown / border closure effect on β |
| **Variant emergence** | Stochastic mutation branching |
| **Healthcare capacity** | ICU saturation → CFR surge coupling |
| **Accessibility** | Screen reader support, keyboard navigation |
| **Mobile layout** | Responsive breakpoints for tablet/phone |

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
