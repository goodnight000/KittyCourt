# Data Export Email Setup

This repo currently uses a stubbed email sender in `server/src/lib/emailService.js`.
When you're ready to send real emails, replace the stub with a provider integration.

## What the export flow expects

`server/src/lib/dataExportService.js` generates a signed download URL and calls:

```
sendDataExportEmail({
  to,
  downloadUrl,
  expiresAt,
  requestId
})
```

Your email implementation should send the `downloadUrl` to the `to` address and mention the expiration time.

## Required Supabase setup

1. Create a private Storage bucket for exports (default: `user-exports`).
2. Optionally override the bucket name with `EXPORT_BUCKET`.
3. Set link TTL with `EXPORT_URL_TTL_SECONDS` (default: 7 days).

## Choose an email provider

Common options:
- Resend
- SendGrid
- AWS SES
- Mailgun

## Suggested environment variables

Add these to your `.env` or server environment (adapt to your provider):

```
EMAIL_PROVIDER=resend
EMAIL_FROM="Pause <no-reply@yourdomain.com>"
EMAIL_API_KEY=your_api_key_here
```

## Implementation checklist

1. Install the provider SDK in `server/`.
2. Update `server/src/lib/emailService.js` to send the email:
   - Subject: "Your Pause data export is ready"
   - Body: include `downloadUrl` and expiration time.
3. Return a result shaped like:

```
{
  status: 'sent',
  sentAt: new Date().toISOString()
}
```

4. Deploy and verify logs show `email_status: sent` in `data_export_requests`.

## Example (pseudo-code)

```
const sendDataExportEmail = async ({ to, downloadUrl, expiresAt }) => {
  await provider.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Your Pause data export is ready',
    html: `<p>Your export is ready. <a href="${downloadUrl}">Download it here</a>.</p>
           <p>Link expires: ${expiresAt}</p>`
  })
  return { status: 'sent', sentAt: new Date().toISOString() }
}
```
