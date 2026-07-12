export interface CompanyContactConfig {
  whatsappNumber: string;
  whatsappDisplay: string;
  email: string;
  serviceHours: {
    label: string;
    value: string;
  }[];
}

export const COMPANY_CONTACT: CompanyContactConfig = {
  whatsappNumber: '628817587308',
  whatsappDisplay: '+62 881-7587-308',
  email: 'Zayyin.alfar1@gmail.com',
  serviceHours: [
    { label: 'Senin - Jumat', value: '08:00 - 18:00' },
    { label: 'Sabtu', value: '08:00 - 15:00' },
    { label: 'Minggu', value: 'Tutup' },
  ],
};

export function buildWhatsappUrl(message: string, phoneNumber = COMPANY_CONTACT.whatsappNumber): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export function buildMailtoUrl(subject: string, body: string, email = COMPANY_CONTACT.email): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
