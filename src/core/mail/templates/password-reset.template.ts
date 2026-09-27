export interface PasswordResetTemplateParams {
  otp: string;
  ttlMinutes: number;
  resetUrl: string;
  appName?: string;
}

export interface PasswordResetTemplate {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function passwordResetTemplate(params: PasswordResetTemplateParams): PasswordResetTemplate {
  const { otp, ttlMinutes, resetUrl } = params;
  const appName = params.appName ?? 'CodeQuest';
  const safeUrl = escapeHtml(resetUrl);
  const safeOtp = escapeHtml(otp);

  const subject = `${appName}: your password reset code`;
  const text =
    `${appName} — password reset\n\n` +
    `Your verification code is: ${otp}\n\n` +
    `It expires in ${ttlMinutes} minutes.\n\n` +
    `Prefer the browser? Open this link and type the code there:\n${resetUrl}\n\n` +
    `If you did not request this, ignore this email — your password stays unchanged.`;

  const html = `<!doctype html>
      <html lang="en">
      <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#efecf5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efecf5;padding:32px 16px;">
      <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #ddd6e8;border-radius:14px;overflow:hidden;">
      <tr><td style="background-color:#170f26;padding:26px 32px;text-align:center;">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:1.5px;">${escapeHtml(appName).toUpperCase()}</div>
      <div style="font-size:12px;color:#b9aee0;margin-top:6px;letter-spacing:3px;">PASSWORD RESET</div>
      </td></tr>
      <tr><td style="padding:24px 32px 0;color:#3d3350;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 8px;">Hi there,</p>
      <p style="margin:0;">Use this verification code to reset your password. It expires in <strong>${ttlMinutes} minutes</strong>.</p>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
      <div style="display:inline-block;background-color:#f4f1fa;border:1px dashed #170f26;border-radius:10px;padding:16px 36px;font-size:32px;font-weight:700;letter-spacing:10px;color:#170f26;">${safeOtp}</div>
      </td></tr>
      <tr><td align="center" style="padding:16px 32px 0;">
      <a href="${safeUrl}" style="display:inline-block;background-color:#170f26;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:8px;">Reset my password</a>
      </td></tr>
      <tr><td style="padding:20px 32px 0;color:#6f6486;font-size:12px;line-height:1.6;">
      <p style="margin:0;">Or paste this link in your browser and type the code there:<br />
      <a href="${safeUrl}" style="color:#170f26;word-break:break-all;">${safeUrl}</a></p>
      </td></tr>
      <tr><td style="padding:20px 32px 28px;color:#8d84a3;font-size:12px;line-height:1.6;">
      <p style="margin:0;padding-top:16px;border-top:1px solid #e7e1f2;">If you did not request this, just ignore this email — your password stays unchanged.</p>
      </td></tr>
      </table>
      <div style="color:#8d84a3;font-size:11px;margin-top:16px;">© ${new Date().getFullYear()} ${escapeHtml(appName)} · Automated message, please do not reply.</div>
      </td></tr>
      </table>
      </body>
      </html>`;

  return { subject, text, html };
}
