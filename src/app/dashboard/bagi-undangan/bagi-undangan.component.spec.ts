import { BagiUndanganComponent } from './bagi-undangan.component';

describe('BagiUndanganComponent', () => {
  let component: BagiUndanganComponent;

  beforeEach(() => {
    component = new BagiUndanganComponent({} as any);
  });

  it('does not restore default greetings when saved settings are explicitly empty', () => {
    (component as any).salamSetting = {
      salam_atas: '',
      salam_bawah: '',
    };
    (component as any).religionContent = {};
    (component as any).weddingData = {};

    const message = (component as any).buildShareMessage('https://sena-digital.com/wedding/demo', 'Tamu Undangan');

    expect(message).not.toContain(component.DEFAULT_SALAM_ATAS);
    expect(message).not.toContain(component.DEFAULT_SALAM_BAWAH);
    expect(message).toContain('https://sena-digital.com/wedding/demo');
  });

  it('does not restore religion defaults when custom WhatsApp greetings are explicitly empty', () => {
    (component as any).religionContent = {
      custom: {
        whatsapp_opening: '',
        whatsapp_message: 'Isi undangan custom.',
        whatsapp_closing: '',
      },
      flags: {
        whatsapp_opening: true,
        whatsapp_closing: true,
      },
      resolved_final: {
        whatsapp_opening: component.DEFAULT_SALAM_ATAS,
        whatsapp_closing: component.DEFAULT_SALAM_BAWAH,
      },
      defaults: {
        whatsapp_opening: component.DEFAULT_SALAM_ATAS,
        whatsapp_closing: component.DEFAULT_SALAM_BAWAH,
      },
    };

    const message = (component as any).buildShareMessage('https://sena-digital.com/wedding/demo', 'Tamu Undangan');

    expect(message).not.toContain(component.DEFAULT_SALAM_ATAS);
    expect(message).not.toContain(component.DEFAULT_SALAM_BAWAH);
    expect(message).toContain('Isi undangan custom.');
    expect(message).toContain('https://sena-digital.com/wedding/demo');
  });
});
