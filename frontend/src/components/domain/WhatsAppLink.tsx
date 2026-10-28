import { MessageCircle } from 'lucide-react';

export function WhatsAppLink({ phone, message = 'Hola, le escribimos del Bufete Popular UMG.' }: { phone?: string | null; message?: string }) {
  const digits = (phone ?? '').replace(/\D/g, '');
  const number = digits.length === 8 ? `502${digits}` : digits;
  if (number.length !== 11 || !number.startsWith('502')) return null;
  return <a href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`Enviar mensaje por WhatsApp al ${phone}`} className="whatsapp-link"><MessageCircle size={16} /> WhatsApp</a>;
}
