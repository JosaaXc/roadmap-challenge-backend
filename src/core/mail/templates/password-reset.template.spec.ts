import { describe, expect, it } from 'vitest';
import { passwordResetTemplate } from './password-reset.template.js';

const params = {
  otp: '482913',
  ttlMinutes: 15,
  resetUrl: 'http://localhost:4200/reset-password?email=user%40example.com',
};

describe('passwordResetTemplate', () => {
  it('includes the OTP and reset URL in both bodies', () => {
    const { subject, text, html } = passwordResetTemplate(params);
    expect(subject).toContain('password reset code');
    expect(text).toContain('482913');
    expect(text).toContain(params.resetUrl);
    expect(html).toContain('482913');
    expect(html).toContain(params.resetUrl);
  });

  it('never embeds the OTP inside a link href (no URL leaks)', () => {
    const { html } = passwordResetTemplate(params);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).not.toContain('482913');
    }
  });

  it('escapes hostile characters in the reset URL', () => {
    const { html } = passwordResetTemplate({ ...params, resetUrl: 'https://x.test/?a="><script>' });
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });
});
