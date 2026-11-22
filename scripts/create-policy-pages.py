"""Generate the June Links policy pages from the site’s current practices."""
from html import escape
from pathlib import Path

PAGES = {
    'privacy': ('Privacy Notice', '''
<h2>What we collect</h2>
<p>June Links uses the contact and trip details you submit to respond to your inquiry and prepare planning options. We ask for your name, email, preferred service tier and confirmation that you are at least 18. Phone, departure city, contact timing and other trip preferences are optional. Leave payment details, identification documents and medical information out of the form.</p>

<h2>How your information is used</h2>
<p>The site saves your inquiry and provides a reference and downloadable trip brief. Relevant trip details may be shared with independent providers to check availability or prepare a proposal. Hosting providers process connection and request information. When email delivery is configured, the email provider processes the inquiry brief for delivery to June Links.</p>

<h2>Preview storage</h2>
<p>Use test details on this review site. Inquiries and associated delivery records are stored in the preview database until the owner removes them. The service keeps short-lived rate-limit records to reduce abuse. Inquiry details are not saved in browser storage. Sending an inquiry does not subscribe you to marketing.</p>

<h2>Location and privacy requests</h2>
<p>If you use the optional device location control and grant permission, approximate coordinates are used for the route preview in your browser. Your selected departure city, if provided, is included in the inquiry.</p>
<p>To ask about access, correction or deletion of your information, email <a href="mailto:info@junelinks.com">info@junelinks.com</a>. Include your inquiry reference if available. We may verify your identity before acting on the request.</p>
'''),
    'terms': ('Terms & Booking Information', '''
<h2>Our role</h2>
<p>June Links is an independent golf travel broker. We help plan golf trips and coordinate options with the independent providers that deliver the services.</p>

<h2>Inquiries and booking</h2>
<p>This website accepts planning inquiries. Bookings and payments are arranged separately after you review and accept the written proposal and the relevant suppliers confirm availability.</p>

<h2>What the proposal covers</h2>
<p>The Round covers golf planning. The Journey adds ground transport planning. The Signature adds accommodation and selected experiences. Before you commit, the proposal identifies the included services, suppliers, contracting party and payment recipient. It sets out prices, currency, fees, taxes, deposits and any material commercial relationships relevant to the booking.</p>

<h2>Changes and cancellations</h2>
<p>Review the supplier terms for access, deposits, changes, cancellations, weather interruptions and refunds before confirming. Those terms apply to the supplier’s services, subject to applicable consumer rights. Check the itinerary and entry requirements for every traveler before departure.</p>

<h2>Photography and other materials</h2>
<p>The <a href="/credits.html">photo and film credits</a> identify image sources and licensing information. For a question about these terms, email <a href="mailto:info@junelinks.com">info@junelinks.com</a>.</p>
'''),
    'accessibility': ('Accessibility', '''
<h2>Using the site</h2>
<p>June Links provides keyboard navigation, visible focus states, descriptive image text and labeled inquiry fields. The form announces errors and moves focus to each new step.</p>

<h2>Motion</h2>
<p>The films and course gallery have pause controls. The inquiry paper animation runs once and follows your device’s reduced motion setting. The site follows the <a href="https://www.w3.org/WAI/WCAG22/Techniques/css/C39">W3C reduced motion technique</a> for that effect.</p>

<h2>Feedback</h2>
<p>If you have difficulty using the site, email <a href="mailto:info@junelinks.com">info@junelinks.com</a> with the page and task you were trying to complete.</p>
'''),
}

def render(title, body):
    title = escape(title)
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>{title} | June Links</title>
  <link rel="icon" type="image/png" sizes="64x64" href="/assets/brand/social-icon-64.png">
  <link rel="apple-touch-icon" href="/assets/brand/social-icon-180.png">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/premium.css">
  <link rel="stylesheet" href="/interactions.css">
  <link rel="stylesheet" href="/refinement.css">
  <link rel="stylesheet" href="/brand.css?v=stationery-1">
</head>
<body>
  <a class="skip" href="#policy">Skip to content</a>
  <header class="header">
    <a class="brand" href="/" aria-label="June Links home"><img class="brand-ink" src="/assets/brand/wordmark-official.png" width="240" height="40" alt="June Links"></a>
    <a href="/">← Back to June Links</a>
  </header>
  <main class="policy wrap section" id="policy">
    <p class="kicker">June Links</p>
    <h1>{title}</h1>
    <p class="policy-alert">Updated November 5, 2026</p>
    {body.strip()}
    <p><a class="text-link" href="/#plan-your-trip">Return to trip planning →</a></p>
  </main>
  <footer class="footer">
    <div class="wrap footer-bottom">
      <span>© 2026 June Links</span>
      <div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/accessibility">Accessibility</a><a href="/credits.html">Photo credits &amp; removal</a></div>
      <div class="footer-credit-row"><a class="footer-credit" href="https://xyopst.com/" target="_blank" rel="noopener noreferrer" aria-label="Powered by Xyopst Inc, opens in a new tab"><span>Powered by Xyopst Inc</span><img src="/assets/xyopst-logo.png" width="86" height="26" loading="lazy" alt=""></a></div>
    </div>
  </footer>
</body>
</html>
'''

if __name__ == '__main__':
    public = Path(__file__).resolve().parents[1] / 'public'
    for slug, (title, body) in PAGES.items():
        (public / f'{slug}.html').write_text(render(title, body), encoding='utf-8')
