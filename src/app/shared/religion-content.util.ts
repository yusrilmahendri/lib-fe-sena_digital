export interface ReligionContentLike {
  religion_code?: string | null;
  religion_label?: string | null;
  defaults?: Record<string, any> | null;
  default?: Record<string, any> | null;
  custom?: Record<string, any> | null;
  resolved?: Record<string, any> | null;
  resolved_final?: Record<string, any> | null;
  [key: string]: any;
}

function isReligionContentObject(value: any): boolean {
  return !!(
    value &&
    typeof value === 'object' &&
    (
      value.resolved ||
      value.resolved_final ||
      value.custom ||
      value.defaults ||
      value.default ||
      value.religion_code ||
      value.religion_label
    )
  );
}

export const RELIGION_FIELD_ALIASES: Record<string, string[]> = {
  opening_greeting: ['opening_greeting', 'whatsapp_opening', 'salam_atas', 'salam', 'salam_pembuka'],
  closing_greeting: ['closing_greeting', 'whatsapp_closing', 'salam_bawah', 'salam_penutup', 'penutup'],
  invitation_intro: ['invitation_intro', 'intro_undangan', 'opening_prayer', 'message', 'salam_pembuka'],
  opening_prayer: ['opening_prayer', 'invitation_intro', 'prayer_text', 'blessing_text', 'message', 'salam_pembuka'],
  whatsapp_opening: ['whatsapp_opening', 'opening_greeting', 'salam_atas', 'salam'],
  whatsapp_message: ['whatsapp_message', 'whatsapp_text', 'pesan_whatsapp', 'invitation_intro', 'message'],
  whatsapp_closing: ['whatsapp_closing', 'closing_greeting', 'salam_bawah', 'penutup'],
  quote_text: ['quote_text', 'quote'],
  quote_source: ['quote_source', 'quote_author', 'quote_reference', 'source'],
  prayer_text: ['prayer_text', 'prayer', 'doa'],
  blessing_text: ['blessing_text', 'blessing', 'berkah', 'closing_greeting'],
  salam_pembuka: ['salam_pembuka', 'invitation_intro', 'opening_prayer', 'message', 'opening_greeting'],
  salam_atas: ['salam_atas', 'whatsapp_opening', 'opening_greeting', 'salam'],
  salam_bawah: ['salam_bawah', 'whatsapp_closing', 'closing_greeting', 'penutup'],
  salam: ['salam', 'opening_greeting', 'salam_atas'],
  penutup: ['penutup', 'closing_greeting', 'whatsapp_closing', 'salam_bawah', 'blessing_text'],
  quote: ['quote', 'quote_text'],
};

export const RELIGION_DEFAULT_TEMPLATES: Record<string, Record<string, string>> = {
  islam: {
    opening_greeting: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
    closing_greeting: "Wassalamu'alaikum Warahmatullahi Wabarakatuh",
    invitation_intro: 'Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
    whatsapp_message: 'Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa restunya, kami ucapkan terima kasih.',
    quote_text: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu.',
    quote_source: 'QS. Ar-Rum: 21',
    prayer_text: 'Semoga Allah SWT memberkahi pernikahan ini dan menghimpun keduanya dalam kebaikan.',
    blessing_text: 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.',
  },
  kristen: {
    opening_greeting: 'Salam sejahtera dalam kasih Tuhan',
    closing_greeting: 'Tuhan memberkati',
    invitation_intro: 'Dengan penuh syukur atas kasih Tuhan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: 'Salam sejahtera dalam kasih Tuhan',
    whatsapp_message: 'Dengan penuh syukur atas kasih Tuhan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa berkatnya, kami ucapkan terima kasih.',
    quote_text: 'Demikianlah mereka bukan lagi dua, melainkan satu.',
    quote_source: 'Matius 19:6',
    prayer_text: 'Kiranya Tuhan menyertai dan memberkati langkah baru kami.',
    blessing_text: 'Merupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa berkat.',
  },
  katolik: {
    opening_greeting: 'Salam damai Kristus',
    closing_greeting: 'Tuhan memberkati',
    invitation_intro: 'Dengan penuh syukur atas berkat Tuhan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: 'Salam damai Kristus',
    whatsapp_message: 'Dengan penuh syukur atas berkat Tuhan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa berkatnya, kami ucapkan terima kasih.',
    quote_text: 'Apa yang telah dipersatukan Allah, tidak boleh diceraikan manusia.',
    quote_source: 'Markus 10:9',
    prayer_text: 'Semoga Tuhan memberkati dan mempersatukan kami dalam kasih-Nya.',
    blessing_text: 'Merupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa berkat.',
  },
  hindu: {
    opening_greeting: 'Om Swastiastu',
    closing_greeting: 'Om Shanti Shanti Shanti Om',
    invitation_intro: 'Dengan penuh syukur kepada Ida Sang Hyang Widhi Wasa, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: 'Om Swastiastu',
    whatsapp_message: 'Dengan penuh syukur kepada Ida Sang Hyang Widhi Wasa, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa restunya, kami ucapkan terima kasih.',
    quote_text: 'Semoga dharma, cinta, dan kesetiaan selalu menuntun perjalanan kami.',
    quote_source: 'Doa pernikahan Hindu',
    prayer_text: 'Semoga Ida Sang Hyang Widhi Wasa senantiasa melimpahkan tuntunan dan kebahagiaan.',
    blessing_text: 'Merupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.',
  },
  buddha: {
    opening_greeting: 'Namo Buddhaya',
    closing_greeting: 'Sabbe Satta Bhavantu Sukhitatta',
    invitation_intro: 'Dengan penuh kebahagiaan dan cinta kasih, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: 'Namo Buddhaya',
    whatsapp_message: 'Dengan penuh kebahagiaan dan cinta kasih, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa baiknya, kami ucapkan terima kasih.',
    quote_text: 'Kebahagiaan bertambah ketika dibagikan dengan cinta kasih dan ketulusan.',
    quote_source: 'Pesan cinta kasih',
    prayer_text: 'Semoga semua makhluk hidup berbahagia.',
    blessing_text: 'Merupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa baik.',
  },
  konghucu: {
    opening_greeting: 'Salam kebajikan',
    closing_greeting: 'Wei De Dong Tian',
    invitation_intro: 'Dengan penuh syukur dan kebajikan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: 'Salam kebajikan',
    whatsapp_message: 'Dengan penuh syukur dan kebajikan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa restunya, kami ucapkan terima kasih.',
    quote_text: 'Kasih dan kebajikan menjadi dasar keluarga yang harmonis.',
    quote_source: 'Pesan kebajikan',
    prayer_text: 'Semoga Tian memberkahi perjalanan keluarga kami dengan damai dan kebajikan.',
    blessing_text: 'Merupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.',
  },
  umum: {
    opening_greeting: 'Salam hangat penuh sukacita',
    closing_greeting: 'Terima kasih atas doa dan restu yang diberikan.',
    invitation_intro: 'Dengan penuh syukur dan kebahagiaan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_opening: 'Salam hangat penuh sukacita',
    whatsapp_message: 'Dengan penuh syukur dan kebahagiaan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.',
    whatsapp_closing: 'Atas kehadiran dan doa restunya, kami ucapkan terima kasih.',
    quote_text: 'Semoga cinta ini menjadi rumah yang teduh, penuh kasih, dan kebaikan.',
    quote_source: 'Doa terbaik untuk kedua mempelai',
    prayer_text: 'Semoga perjalanan baru ini dipenuhi kasih, damai, dan kebahagiaan.',
    blessing_text: 'Merupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.',
  },
};

export function normalizeReligionCode(value: unknown): string {
  const code = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (code === 'budha') return 'buddha';
  if (code === 'kong hu cu' || code === 'khonghucu') return 'konghucu';
  return code;
}

export function getReligionKeys(keys: string[]): string[] {
  const result: string[] = [];
  keys.forEach((key) => {
    (RELIGION_FIELD_ALIASES[key] || [key]).forEach((alias) => {
      if (!result.includes(alias)) {
        result.push(alias);
      }
    });
  });
  return result;
}

export function getResolvedReligionValue(
  religionContent: ReligionContentLike | null | undefined,
  ...keys: string[]
): string {
  const religion = religionContent || {};
  const aliases = getReligionKeys(keys);
  const resolvedFinal = religion.resolved_final || {};
  const resolved = religion.resolved || {};
  const custom = religion.custom || {};
  const defaults = religion.defaults || {};
  const defaultValues = religion.default || {};
  const sources = [resolvedFinal, resolved, custom, defaults, defaultValues, religion];

  for (const key of aliases) {
    for (const source of sources) {
      const value = source?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return '';
}

export function getReligionContentFromData(data: any): ReligionContentLike {
  if (isReligionContentObject(data)) {
    return data;
  }

  if (isReligionContentObject(data?.religion_content)) {
    return data.religion_content;
  }

  if (isReligionContentObject(data?.religionContent)) {
    return data.religionContent;
  }

  if (isReligionContentObject(data?.religion)) {
    return data.religion;
  }

  if (isReligionContentObject(data?.data?.religion_content)) {
    return data.data.religion_content;
  }

  if (isReligionContentObject(data?.data?.religionContent)) {
    return data.data.religionContent;
  }

  if (isReligionContentObject(data?.data)) {
    return data.data;
  }

  return (
    data?.religion_content ||
    data?.religionContent ||
    data?.religion ||
    data?.data?.religion_content ||
    data?.data?.religionContent ||
    {}
  );
}

export function readReligionMapValue(source: Record<string, any> | null | undefined, ...keys: string[]): string {
  const aliases = getReligionKeys(keys);
  for (const key of aliases) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}
