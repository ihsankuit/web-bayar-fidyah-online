import { describe, expect, it } from "vitest";
import { parseContacts } from "./contacts";

describe("parseContacts", () => {
  it("parses name,phone lines", () => {
    const { contacts } = parseContacts("Ahmad,0123456789\nSiti,0198765432");
    expect(contacts).toEqual([
      { name: "Ahmad", phone: "60123456789" },
      { name: "Siti", phone: "60198765432" },
    ]);
  });

  it("accepts tab and semicolon separators", () => {
    const { contacts } = parseContacts("Ahmad\t0123456789\nSiti;0198765432");
    expect(contacts.map((c) => c.phone)).toEqual([
      "60123456789",
      "60198765432",
    ]);
  });

  it("detects the phone column whichever side it is on", () => {
    const { contacts } = parseContacts("0123456789,Ahmad");
    expect(contacts).toEqual([{ name: "Ahmad", phone: "60123456789" }]);
  });

  it("accepts a bare number with no name", () => {
    const { contacts } = parseContacts("0123456789");
    expect(contacts).toEqual([{ name: "", phone: "60123456789" }]);
  });

  it("skips a header row", () => {
    const { contacts } = parseContacts("Nama,Telefon\nAhmad,0123456789");
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe("Ahmad");
  });

  it("normalizes assorted local formats to 60xxxxxxxxx", () => {
    const { contacts } = parseContacts(
      "A,012-345 6789\nB,+60198765432\nC,60123456780"
    );
    expect(contacts.map((c) => c.phone)).toEqual([
      "60123456789",
      "60198765432",
      "60123456780",
    ]);
  });

  it("reports lines with no usable number instead of dropping them silently", () => {
    const { contacts, skipped } = parseContacts("Ahmad,0123456789\nSiti,abc");
    expect(contacts).toHaveLength(1);
    expect(skipped).toEqual([2]);
  });

  it("counts duplicates by normalized phone", () => {
    const { contacts, duplicates } = parseContacts(
      "Ahmad,0123456789\nAhmad Lain,60123456789"
    );
    expect(contacts).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it("ignores blank lines and surrounding quotes", () => {
    const { contacts } = parseContacts('\n"Ahmad","0123456789"\n\n');
    expect(contacts).toEqual([{ name: "Ahmad", phone: "60123456789" }]);
  });
});
