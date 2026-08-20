# White-screen investigation

On 2026-08-20, the live URL https://aodxx.github.io/ParaWallet/ reproduced a blank viewport with no interactive elements. Browser title remained `ParaWallet · Dual Wallet System`, indicating the HTML document loaded but the React application did not render visible content. Browser DOM was captured at `/home/ubuntu/browser_html/aodxx_github_io_ParaWallet_1787234818117.html` for inspection. The next checks are deployed asset paths, script loading status, runtime console errors, and service-worker/cache behavior.
