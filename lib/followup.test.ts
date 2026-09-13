import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOLLOWUP_STAGES,
  MAX_FOLLOWUP_STAGES,
  normalizeFollowUpSettings,
  stageIndexForCount,
} from "./followup";

describe("normalizeFollowUpSettings", () => {
  it("falls back to the shipped sequence when nothing is stored", () => {
    expect(normalizeFollowUpSettings(undefined).stages).toEqual(
      DEFAULT_FOLLOWUP_STAGES
    );
    expect(normalizeFollowUpSettings({}).stages).toEqual(
      DEFAULT_FOLLOWUP_STAGES
    );
  });

  it("keeps a pre-sequence flat template as step 1", () => {
    // What the settings row looked like before the sequence existed. The
    // admin wrote that wording, so it has to survive the migration.
    const { stages } = normalizeFollowUpSettings({
      whatsapp_message: "Ayat saya sendiri",
      email_subject: "Tajuk saya",
      email_body: "Kandungan saya",
    });

    expect(stages[0]).toEqual({
      name: DEFAULT_FOLLOWUP_STAGES[0].name,
      whatsapp_message: "Ayat saya sendiri",
      email_subject: "Tajuk saya",
      email_body: "Kandungan saya",
    });
  });

  it("appends the later steps when migrating a flat template", () => {
    const { stages } = normalizeFollowUpSettings({
      whatsapp_message: "Ayat saya sendiri",
    });

    expect(stages).toHaveLength(DEFAULT_FOLLOWUP_STAGES.length);
    expect(stages.slice(1)).toEqual(DEFAULT_FOLLOWUP_STAGES.slice(1));
  });

  it("reads a stored sequence as-is", () => {
    const stored = {
      stages: [
        {
          name: "Peringatan A",
          whatsapp_message: "wa-a",
          email_subject: "subj-a",
          email_body: "body-a",
        },
        {
          name: "Peringatan B",
          whatsapp_message: "wa-b",
          email_subject: "subj-b",
          email_body: "body-b",
        },
      ],
    };
    expect(normalizeFollowUpSettings(stored).stages).toEqual(stored.stages);
  });

  it("fills a half-written step from the shipped one in that position", () => {
    const { stages } = normalizeFollowUpSettings({
      stages: [
        { whatsapp_message: "hanya wa" },
        { email_body: "hanya emel" },
      ],
    });

    expect(stages[0].email_subject).toBe(
      DEFAULT_FOLLOWUP_STAGES[0].email_subject
    );
    expect(stages[1].whatsapp_message).toBe(
      DEFAULT_FOLLOWUP_STAGES[1].whatsapp_message
    );
    expect(stages[1].email_body).toBe("hanya emel");
  });

  it("drops blank steps and garbage entries", () => {
    const { stages } = normalizeFollowUpSettings({
      stages: [
        { whatsapp_message: "ada isi" },
        { name: "Kosong", whatsapp_message: "   ", email_body: "" },
        null,
        "bukan objek",
      ],
    });
    expect(stages).toHaveLength(1);
    expect(stages[0].whatsapp_message).toBe("ada isi");
  });

  it("caps a stored sequence at the maximum", () => {
    const stages = Array.from({ length: MAX_FOLLOWUP_STAGES + 3 }, (_, i) => ({
      name: `S${i}`,
      whatsapp_message: `wa-${i}`,
      email_subject: `subj-${i}`,
      email_body: `body-${i}`,
    }));
    expect(normalizeFollowUpSettings({ stages }).stages).toHaveLength(
      MAX_FOLLOWUP_STAGES
    );
  });
});

describe("stageIndexForCount", () => {
  const settings = normalizeFollowUpSettings(undefined);

  it("starts an un-chased payer at step 1", () => {
    expect(stageIndexForCount(settings, 0)).toBe(0);
    expect(stageIndexForCount(settings, null)).toBe(0);
    expect(stageIndexForCount(settings, undefined)).toBe(0);
  });

  it("advances one step per reminder already sent", () => {
    expect(stageIndexForCount(settings, 1)).toBe(1);
    expect(stageIndexForCount(settings, 2)).toBe(2);
  });

  it("holds on the last step instead of running off the end", () => {
    const last = settings.stages.length - 1;
    expect(stageIndexForCount(settings, 99)).toBe(last);
  });

  it("treats a negative count as no reminders sent", () => {
    expect(stageIndexForCount(settings, -3)).toBe(0);
  });

  it("stays in range for a single-step sequence", () => {
    const single = normalizeFollowUpSettings({
      stages: [{ whatsapp_message: "satu sahaja" }],
    });
    expect(stageIndexForCount(single, 7)).toBe(0);
  });
});
