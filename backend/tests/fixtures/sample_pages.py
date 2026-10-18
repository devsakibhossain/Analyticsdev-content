# Local HTML Fixtures for Automated Testing

SAMPLE_ECOMMERCE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Modern Apparel - Premium Organic Clothing Store</title>
    <meta name="description" content="Shop premium organic t-shirts, jackets, and accessories with free global shipping.">
    <meta property="og:site_name" content="Modern Apparel Store">
    <script src="https://cdn.shopify.com/s/files/1/0001/theme.js"></script>
    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-1122334455"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-1122334455');
      gtag('config', 'AW-9988776655');
    </script>
    <!-- Meta Pixel Code -->
    <script>
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '123456789012345');
      fbq('track', 'PageView');
    </script>
    <!-- Microsoft Clarity -->
    <script type="text/javascript">
      (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "claritytest123");
    </script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "ClothingStore",
      "name": "Modern Apparel",
      "telephone": "+1-800-555-0199",
      "email": "orders@modernapparel.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "456 Market Street",
        "addressLocality": "San Francisco",
        "addressRegion": "CA",
        "postalCode": "94103",
        "addressCountry": "US"
      }
    }
    </script>
</head>
<body>
    <header>
        <img src="/assets/logo.png" alt="Modern Apparel Logo">
        <a href="mailto:sales@modernapparel.com">Sales Contact</a>
        <a href="https://wa.me/18005550199">Chat on WhatsApp</a>
    </header>
    <main>
        <h1>Sustainable Fashion & Organic Apparel</h1>
        <div class="product-item">
            <span class="price">$49.00</span>
            <button class="add-to-cart-btn">Add to Cart</button>
        </div>
        <a href="/checkout" class="btn-checkout">Go to Checkout</a>
    </main>
    <footer>
        <a href="https://www.instagram.com/modernapparel">Instagram</a>
        <a href="https://facebook.com/modernapparel">Facebook</a>
        <a href="https://tiktok.com/@modernapparel">TikTok</a>
        <p>&copy; 2026 Modern Apparel LLC. All rights reserved.</p>
    </footer>
</body>
</html>
"""

SAMPLE_DENTAL_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Austin Smile Center - Family & Cosmetic Dentist Austin TX</title>
    <meta name="description" content="Top rated family dentist in Austin TX offering teeth whitening, dental implants, and emergency dental care.">
    <meta name="generator" content="WordPress 6.4.3">
    <link rel="stylesheet" href="/wp-content/themes/dental-theme/style.css">
    <!-- GA4 without GTM -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-9876543210"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-9876543210');
    </script>
    <!-- Calendly -->
    <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Dentist",
      "name": "Austin Smile Center",
      "telephone": "+1 512-555-7890",
      "email": "contact@austinsmilecenter.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "789 Congress Ave",
        "addressLocality": "Austin",
        "addressRegion": "TX",
        "postalCode": "78701",
        "addressCountry": "United States"
      }
    }
    </script>
</head>
<body>
    <header>
        <img src="/wp-content/uploads/logo.png" alt="Austin Smile Center">
        <a href="tel:+15125557890">(512) 555-7890</a>
    </header>
    <main>
        <h1>Gentle Family Dental Care & Teeth Whitening</h1>
        <p>Book your appointment with our award-winning dentists.</p>
        <form action="/submit-appointment" method="POST">
            <input type="text" name="name" placeholder="Your Name" required>
            <input type="email" name="email" placeholder="Your Email" required>
            <textarea name="notes" placeholder="Reason for dental visit"></textarea>
            <button type="submit">Request Consultation</button>
        </form>
    </main>
    <footer>
        <a href="https://linkedin.com/company/austin-smile-center">LinkedIn</a>
        <a href="https://youtube.com/@austinsmilecenter">YouTube</a>
        <p>Copyright &copy; 2026 Austin Smile Center. Dental Practice.</p>
    </footer>
</body>
</html>
"""

SAMPLE_SAAS_HTML = """
<!DOCTYPE html>
<html data-wf-page="64b9" lang="en">
<head>
    <meta charset="UTF-8">
    <title>CloudSync | Real-Time Database Replication & Cloud Backup</title>
    <meta name="description" content="Automate enterprise database backups, PostgreSQL replication, and cloud failover with zero downtime.">
    <meta content="Webflow" name="generator">
    <script src="https://assets-global.website-files.com/webflow.js"></script>
    <!-- GTM -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-PROD999');</script>
    <!-- Hotjar -->
    <script>
      (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:3344556,hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
      })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
    </script>
</head>
<body>
    <header>
        <span class="brand">CloudSync SaaS</span>
        <a href="mailto:support@cloudsync.io">Support</a>
    </header>
    <main>
        <h1>Enterprise Cloud Database Sync & SaaS Backups</h1>
        <p>Start your 14-day free trial. Instant setup with our developer API and monthly subscription plans.</p>
    </main>
    <footer>
        <a href="https://x.com/cloudsync_hq">Twitter</a>
        <p>&copy; 2026 CloudSync Technologies Inc.</p>
    </footer>
</body>
</html>
"""
