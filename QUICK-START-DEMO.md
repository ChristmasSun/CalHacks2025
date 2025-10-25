# 🚀 Quick Start - Demo in 5 Minutes

## Option 1: Instant Demo Mode (Recommended for Live Demos)

```bash
# 1. Enable demo mode (instant results!)
npm run demo:mode

# 2. Start the app
npm start

# 3. Demo!
# - Contact verification: 1-2 seconds (instead of 2-3 minutes)
# - All results are realistic mock data
# - Perfect for time-constrained presentations
```

**Demo contacts that work instantly:**
```
John Smith
Senior Software Engineer at Google
john.smith@google.com
```

---

## Option 2: Real Mode with Pre-Caching (Impressive but Slower)

```bash
# 1. Pre-cache data (takes 5-10 minutes, run once)
npm run demo:prep

# 2. Enable real mode
npm run demo:real

# 3. Start the app
npm start

# 4. Demo!
# - First verification: Shows real LinkedIn scraping
# - Repeated verification: Instant (cached!)
# - More impressive but requires pre-run
```

---

## What to Demo

### 1. URL Scanning (30 seconds)
- Start monitoring
- Visit https://www.paypal.com → ✅ Safe
- Visit https://phishing-site.com → 🔴 Scam detected

### 2. Contact Verification (1 minute)
Paste this:
```
Hi, I'm John Smith
Senior Software Engineer at Google
john.smith@google.com
```

**Result (Demo Mode):** ✅ Verified in 1-2 seconds!

**Result (Real Mode, cached):** ✅ Verified instantly (was pre-cached)!

### 3. Suspicious Contact (1 minute)
Paste this:
```
Sarah Johnson
CEO of Microsoft
sarah.johnson@gmail.com
```

**Result:** ⚠️ Suspicious - Gmail doesn't match Microsoft domain!

---

## Troubleshooting

**LinkedIn taking too long?**
```bash
# Switch to demo mode mid-presentation
npm run demo:mode
# Restart app
npm start
```

**API not working?**
- Demo mode doesn't need APIs!
- All results are pre-generated mock data

**App crashed?**
- Have backup video recording ready
- Or show screenshots from `DEMO-README.md`

---

## Pro Tips

1. **Practice 3 times** before real demo
2. **Use demo mode** for live presentations
3. **Pre-cache** for technical demos
4. **Have backup scenarios** ready
5. **Don't panic** if something breaks!

---

## Need More Help?

- 📖 Full guide: [DEMO-README.md](./DEMO-README.md)
- 🎬 Talking points: Run `npm run demo:prep` to generate
- 🐛 Issues: Check terminal logs during `npm start`

---

**You're ready! Good luck! 🎉**
