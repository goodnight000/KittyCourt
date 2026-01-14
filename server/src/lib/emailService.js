/**
 * Email Service (Stub)
 *
 * Replace with a real provider (Resend, SendGrid, SES, etc.).
 */

const sendDataExportEmail = async ({ to, downloadUrl, expiresAt, requestId }) => {
    const sentAt = new Date().toISOString();
    console.log('[Email][Stub] Data export email requested', {
        to,
        requestId,
        downloadUrl,
        expiresAt,
    });

    return {
        status: 'stubbed',
        sentAt,
    };
};

module.exports = {
    sendDataExportEmail,
};
