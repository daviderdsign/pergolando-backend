import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * SMTP-backed email sending. Config comes entirely from env vars (never
 * hardcoded) — see .env.example. If SMTP_HOST is unset, sends are logged
 * instead of attempted, so local dev without a real mailbox doesn't hard
 * fail (EMAIL_VERIFICATION_ENABLED=false is the normal way to skip this
 * in dev; this is a second-line fallback for misconfiguration).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    if (!host) return null;

    this.transporter = createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    return this.transporter;
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: 'Conferma la tua registrazione — Pergolando',
      text: `Il tuo codice di verifica è: ${code}\n\nScade tra 15 minuti. Se non hai richiesto questa registrazione, ignora questa email.`,
      html: verificationEmailHtml(code),
    });
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reimposta la password — Pergolando',
      text: `Il tuo codice per reimpostare la password è: ${code}\n\nScade tra 15 minuti. Se non hai richiesto questo reset, ignora questa email: la tua password attuale resta valida.`,
      html: resetEmailHtml(code),
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM ?? 'noreply@localhost';

    if (!transporter) {
      this.logger.warn(
        `SMTP_HOST not configured — email not sent. Would have sent "${message.subject}" to ${message.to}.`,
      );
      return;
    }

    await transporter.sendMail({ from, ...message });
  }
}

function verificationEmailHtml(code: string): string {
  return `<p>Grazie per esserti registrato su Pergolando.</p>
<p>Il tuo codice di verifica è:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
<p>Scade tra 15 minuti.</p>`;
}

function resetEmailHtml(code: string): string {
  return `<p>Hai richiesto di reimpostare la password su Pergolando.</p>
<p>Il tuo codice è:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
<p>Scade tra 15 minuti. Se non sei stato tu, ignora questa email.</p>`;
}
