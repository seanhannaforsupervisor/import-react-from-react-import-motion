const TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'seanhannaforsupervisor@gmail.com';
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'Friends of Sean Hanna <onboarding@resend.dev>';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email service is not configured yet.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = String(body.name || '').trim().slice(0, 200);
    const email = String(body.email || '').trim().slice(0, 320);
    const phone = String(body.phone || '').trim().slice(0, 50);
    const smsConsent = body.smsConsent === true;
    const website = String(body.website || '').trim();

    // Honeypot for basic bot protection.
    if (website) {
      return res.status(200).json({ ok: true });
    }

    const submittedAt = new Date().toISOString();
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '').split(',')[0].trim();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

    const consentLanguage = 'By signing up, you consent to receive campaign updates, event information, and get-out-the-vote reminders via text message from Friends of Sean Hanna at the number provided. Msg & data rates may apply. Msg frequency varies. Unsubscribe at any time by replying STOP. Reply HELP for help. Privacy Policy & Terms at https://www.hannaforsupervisor.com/privacy/';

    const text = [
      'New campaign website submission',
      '',
      'Name: ' + (name || 'Not provided'),
      'Email: ' + (email || 'Not provided'),
      'Phone: ' + (phone || 'Not provided'),
      'SMS opt-in: ' + (smsConsent ? 'YES - checkbox checked' : 'NO'),
      'Submitted at: ' + submittedAt,
      'IP address: ' + (ip || 'Unavailable'),
      'User agent: ' + (userAgent || 'Unavailable'),
      '',
      'Consent language displayed:',
      consentLanguage
    ].join('\n');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: 'New campaign website submission' + (smsConsent ? ' - SMS OPT-IN' : ''),
        text,
        reply_to: email || undefined
      })
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      console.error('Resend error:', details);
      return res.status(502).json({ error: 'Email delivery failed.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Unable to process submission.' });
  }
}
