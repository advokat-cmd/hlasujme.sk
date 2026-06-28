"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "../ui/Icons";
import { Btn } from "../ui/Button";
import { Pill } from "../ui/Pill";
import { Card } from "../ui/Card";
import { Stat } from "../ui/Stat";
import { TableScroll, useNarrow } from "../ui/LayoutHelpers";
import { PageHead } from "./PageHead";
import { Modal } from "../ui/Modal";
import { FormRow, Input } from "../ui/FormControls";

interface RegisterOwner {
  id: string;
  first: string;
  last: string;
  name: string;
  email: string | null;
  share: number;
  role: string;
  admin: boolean;
  password?: string;
}

interface RegisterUnit {
  id: string;
  no: string;
  type: string;
  floor: string;
  votes: number;
  coMode: string;
  email: string | null;
  actingPerson: string | null;
  label: string | null;
  owners: RegisterOwner[];
}

interface RegisterViewProps {
  building: {
    id: string;
    name: string;
    short: string | null;
    address: string;
    entrance: string;
    manager: string;
    contact: string;
    contactEmail: string;
  };
  units: RegisterUnit[];
  stats: {
    unitsCount: number;
    nonResCount: number;
    ownersCount: number;
    totalVotes: number;
  };
}

const CO_MODE_LABEL: Record<string, string> = {
  single: "Jediný vlastník",
  rep: "Určený zástupca",
  internal: "Interné hlasovanie",
  majority: "Väčšinový spoluvlastník",
  bsm: "BSM manželov",
  legal: "Právnická osoba",
};

export const RegisterView: React.FC<RegisterViewProps> = ({
  building,
  units,
  stats,
}) => {
  const router = useRouter();
  const isMobile = useNarrow(600);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editBuilding, setEditBuilding] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [creatingUnit, setCreatingUnit] = useState(false);

  const list = units.filter((u) => {
    const s = `${u.no} ${u.owners.map((o) => o.name).join(" ")} ${CO_MODE_LABEL[u.coMode]}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  const getOwnerInitials = (name: string) => {
    return name
      .split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="admin-page-container">
      <PageHead eyebrow={`${building.name} · ${building.address}`} title="Dom a vlastníci">
        <Btn kind="secondary" icon="edit" onClick={() => setEditBuilding(true)}>
          Upraviť dom
        </Btn>
        <Btn kind="primary" icon="plus" onClick={() => setCreatingUnit(true)}>
          Pridať jednotku
        </Btn>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
        <Card pad={18}>
          <Stat label="Bytov" value={stats.unitsCount - stats.nonResCount} />
        </Card>
        <Card pad={18}>
          <Stat label="Nebytových priestorov" value={stats.nonResCount} />
        </Card>
        <Card pad={18}>
          <Stat label="Vlastníkov" value={stats.ownersCount} />
        </Card>
        <Card pad={18}>
          <Stat label="Oprávnených hlasov" value={stats.totalVotes} />
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Ic name="search" size={16} style={{ position: "absolute", left: 11, top: 9, color: "var(--ink-faint)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Hľadať byt alebo vlastníka"
              placeholder="Hľadať byt alebo vlastníka…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 12px 8px 34px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                fontFamily: "inherit",
                fontSize: "13.5px",
                background: "var(--paper)",
              }}
            />
          </div>
          <span style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>{list.length} jednotiek</span>
        </div>
        
        <div style={isMobile ? {} : { overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={isMobile ? {} : { minWidth: 600 }}>
            {!isMobile && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr 200px 150px 90px",
                  gap: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  padding: "10px 18px",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--paper-2)",
                }}
              >
                <div>Jedn.</div>
                <div>Vlastník</div>
                <div>Režim hlasovania</div>
                <div>E-mail</div>
                <div>Stav</div>
              </div>
            )}
            
            {list.map((u) => {
              const open = openId === u.id;
              const noEmail = !u.email && u.coMode !== "internal";
              return (
                <div key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    aria-label={`Byt č. ${u.no} — ${u.owners[0]?.name || "Vlastník"}, ${open ? "zbaliť" : "rozbaliť"} detail`}
                    onClick={() => setOpenId(open ? null : u.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(open ? null : u.id);
                      }
                    }}
                    style={isMobile ? {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 8,
                      padding: "16px 14px",
                      cursor: "pointer",
                      fontSize: "13.5px",
                      background: open ? "var(--paper-2)" : "transparent",
                    } : {
                      display: "grid",
                      gridTemplateColumns: "64px 1fr 200px 150px 90px",
                      gap: 0,
                      alignItems: "center",
                      padding: "12px 18px",
                      cursor: "pointer",
                      fontSize: "13.5px",
                      background: open ? "var(--paper-2)" : "transparent",
                    }}
                  >
                    {isMobile ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px" }}>
                            Jednotka {u.no} {u.type === "nebyt" && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-ink)", marginLeft: 6 }}>NP</span>}
                          </span>
                          <Ic
                            name="chevD"
                            size={16}
                            style={{
                              color: "var(--ink-faint)",
                              transform: open ? "rotate(180deg)" : "none",
                              transition: "transform .2s",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{u.owners[0]?.name || "Vlastník"}</span>
                          {u.owners.length > 1 && <Pill tone="neutral" size="sm">+{u.owners.length - 1}</Pill>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Pill tone={u.coMode === "single" ? "neutral" : "primary"} size="sm">
                            {CO_MODE_LABEL[u.coMode]}
                          </Pill>
                          <span
                            style={{
                              fontSize: "12.5px",
                              color: noEmail ? "var(--disagree)" : "var(--ink-soft)",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {noEmail ? (
                              <>
                                <Ic name="alert" size={13} /> chýba e-mail
                              </>
                            ) : (
                              <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 200 }}>
                                {u.email || u.owners.map(o => o.email).filter(Boolean).join(", ")}
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {u.no}
                          {u.type === "nebyt" && <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-ink)" }}>NP</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{u.owners[0]?.name || "Vlastník"}</span>
                          {u.owners.length > 1 && <Pill tone="neutral" size="sm">+{u.owners.length - 1}</Pill>}
                        </div>
                        <div>
                          <Pill tone={u.coMode === "single" ? "neutral" : "primary"} size="sm">
                            {CO_MODE_LABEL[u.coMode]}
                          </Pill>
                        </div>
                        <div
                          style={{
                            fontSize: "12.5px",
                            color: noEmail ? "var(--disagree)" : "var(--ink-soft)",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {noEmail ? (
                            <>
                              <Ic name="alert" size={13} /> chýba
                            </>
                          ) : (
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {u.email || u.owners.map(o => o.email).filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                        <div>
                          <Ic
                            name="chevD"
                            size={16}
                            style={{
                              color: "var(--ink-faint)",
                              transform: open ? "rotate(180deg)" : "none",
                              transition: "transform .2s",
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  
                  {open && (
                    <div style={{ padding: isMobile ? "12px 14px 20px" : "4px 18px 20px 82px", background: "var(--paper-2)" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: "12.5px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, fontSize: "10.5px" }}>
                            Typ
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {u.type === "byt" ? "Byt" : u.label || "Nebytový priestor"} · {u.floor} poschodie
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, fontSize: "10.5px" }}>
                            Počet hlasov
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{u.votes}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, fontSize: "10.5px" }}>
                            Režim spoluvlastníctva
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{CO_MODE_LABEL[u.coMode]}</div>
                        </div>
                        {u.actingPerson && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, fontSize: "10.5px" }}>
                              Koná za vlastníka
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{u.actingPerson}</div>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                        {u.owners.map((o, idx) => (
                          <div
                            key={o.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              background: "var(--surface)",
                              border: "1px solid var(--line)",
                              borderRadius: 9,
                            }}
                          >
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 999,
                                background: "var(--primary-bg)",
                                color: "var(--primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {getOwnerInitials(o.name)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                {o.name}
                                {u.coMode === "rep" && idx === 0 && <Pill tone="accent" size="sm" icon="check">hlasuje za byt</Pill>}
                                {o.admin && <Pill tone="primary" size="sm" icon="shield">administrátor</Pill>}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>
                                {o.email || "bez e-mailu"} · podiel {Math.round(o.share * 100)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div style={{ marginTop: 14 }}>
                        <Btn kind="secondary" size="sm" icon="edit" onClick={() => setEditUnitId(u.id)}>
                          Upraviť jednotku a vlastníkov
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {editBuilding && (
        <BuildingForm
          building={building}
          onClose={() => setEditBuilding(false)}
          onSaved={() => {
            setEditBuilding(false);
            router.refresh();
          }}
        />
      )}

      {creatingUnit && (
        <UnitForm
          onClose={() => setCreatingUnit(false)}
          onSaved={() => {
            setCreatingUnit(false);
            router.refresh();
          }}
        />
      )}

      {editUnitId && (
        <UnitForm
          unitId={editUnitId}
          unit={units.find((u) => u.id === editUnitId)}
          onClose={() => setEditUnitId(null)}
          onSaved={() => {
            setEditUnitId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
};

// Building details Edit Form
interface BuildingFormProps {
  building: any;
  onClose: () => void;
  onSaved: () => void;
}

const BuildingForm: React.FC<BuildingFormProps> = ({ building, onClose, onSaved }) => {
  const [f, setF] = useState({ ...building });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const save = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/building", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Uloženie zlyhalo.");
      } else {
        onSaved();
      }
    } catch (err) {
      setError("Chyba pri ukladaní údajov.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Upraviť bytový dom"
      subtitle="Zmeny sa prejavia v celej aplikácii — v menu, hlasovaní aj pozvánkach"
      icon="building"
      onClose={onClose}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose} disabled={loading}>
            Zrušiť
          </Btn>
          <Btn kind="primary" icon="check" onClick={save} disabled={loading}>
            {loading ? "Ukladám..." : "Uložiť zmeny"}
          </Btn>
        </>
      }
    >
      {error && <div style={{ color: "var(--disagree)", marginBottom: 12 }}>{error}</div>}
      <FormRow label="Názov domu">
        <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
      </FormRow>
      <FormRow label="Skrátený názov" hint="Zobrazuje sa v ľavom menu administrátora.">
        <Input value={f.short || ""} onChange={(e) => set("short", e.target.value)} />
      </FormRow>
      <FormRow label="Adresa">
        <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FormRow label="Vchod">
          <Input value={f.entrance} onChange={(e) => set("entrance", e.target.value)} />
        </FormRow>
        <FormRow label="Správca">
          <Input value={f.manager} onChange={(e) => set("manager", e.target.value)} />
        </FormRow>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FormRow label="Kontaktná osoba">
          <Input value={f.contact} onChange={(e) => set("contact", e.target.value)} />
        </FormRow>
        <FormRow label="Kontaktný e-mail">
          <Input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </FormRow>
      </div>
    </Modal>
  );
};

// Unit adding/editing Form
interface UnitFormProps {
  unitId?: string;
  unit?: any;
  onClose: () => void;
  onSaved: () => void;
}

const UnitForm: React.FC<UnitFormProps> = ({ unitId, unit, onClose, onSaved }) => {
  const creating = !unitId;
  const [no, setNo] = useState(unit?.no || "");
  const [type, setType] = useState(unit?.type || "byt");
  const [floor, setFloor] = useState(unit?.floor || "");
  const [email, setEmail] = useState(unit?.email || "");
  const [coMode, setCoMode] = useState(unit?.coMode || "single");
  const [owners, setOwners] = useState<any[]>(
    unit ? unit.owners.map((o: any) => ({ ...o, first: o.first || o.name.split(" ")[0], last: o.last || o.name.split(" ")[1] || "", password: "" })) : [{ id: Math.random().toString(), first: "", last: "", email: "", share: 1, role: "owner", admin: false, password: "" }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setOwner = (i: number, k: string, v: any) => {
    setOwners((os) => os.map((o, idx) => (idx === i ? { ...o, [k]: v } : o)));
  };

  const addOwner = () => {
    setOwners((os) => [...os, { id: Math.random().toString(), first: "", last: "", email: "", share: 0.5, role: "coowner", admin: false, password: "" }]);
  };

  const rmOwner = (i: number) => {
    setOwners((os) => (os.length > 1 ? os.filter((_, idx) => idx !== i) : os));
  };

  const genPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const save = async () => {
    setLoading(true);
    setError("");

    try {
      const payload = {
        no,
        type,
        floor,
        email,
        coMode,
        owners,
      };

      const url = creating ? "/api/admin/unit" : `/api/admin/unit/${unitId}`;
      const method = creating ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Uloženie jednotky zlyhalo.");
      } else {
        onSaved();
      }
    } catch (err) {
      setError("Chyba pri ukladaní údajov jednotky.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={creating ? "Pridať jednotku" : `Upraviť byt č. ${unit.no}`}
      subtitle="Údaje jednotky, režim hlasovania a vlastníci"
      icon={creating ? "building" : "user"}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Btn kind="secondary" onClick={onClose} disabled={loading}>
            Zrušiť
          </Btn>
          <Btn kind="primary" icon={creating ? "plus" : "check"} onClick={save} disabled={loading}>
            {loading ? "Ukladám..." : creating ? "Pridať jednotku" : "Uložiť zmeny"}
          </Btn>
        </>
      }
    >
      {error && <div style={{ color: "var(--disagree)", marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <FormRow label="Číslo jednotky">
          <Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="napr. 12" />
        </FormRow>
        <FormRow label="Typ jednotky">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 12px",
              borderRadius: 9,
              border: "1px solid var(--line)",
              fontFamily: "inherit",
              fontSize: "13.5px",
              background: "var(--paper)",
              color: "var(--ink)",
            }}
          >
            <option value="byt">Byt</option>
            <option value="nebyt">Nebytový priestor</option>
          </select>
        </FormRow>
        <FormRow label="Poschodie">
          <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="napr. 3." />
        </FormRow>
      </div>

      <FormRow label="Režim hlasovania" hint="Pri spoluvlastníctve určuje, ako sa započíta jeden hlas za jednotku.">
        <select
          value={coMode}
          onChange={(e) => setCoMode(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 12px",
            borderRadius: 9,
            border: "1px solid var(--line)",
            fontFamily: "inherit",
            fontSize: "13.5px",
            background: "var(--paper)",
            color: "var(--ink)",
          }}
        >
          {Object.entries(CO_MODE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </FormRow>

      <FormRow label="E-mail na hlasovanie (jednotka)" hint="Naň sa odošle osobný hlasovací link.">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="napr. vlastnik@email.sk" />
      </FormRow>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Vlastníci
        </div>
        <Btn kind="secondary" size="sm" icon="plus" onClick={addOwner}>
          Pridať vlastníka
        </Btn>
      </div>

      {owners.map((o, idx) => (
        <div
          key={o.id}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 11,
            padding: "14px 14px 2px",
            marginBottom: 10,
            background: "var(--paper-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>Vlastník {idx + 1}</div>
            {owners.length > 1 && (
              <button
                type="button"
                onClick={() => rmOwner(idx)}
                title="Odobrať vlastníka"
                aria-label="Odobrať vlastníka"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", display: "flex" }}
              >
                <Ic name="x" size={17} />
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormRow label="Meno">
              <Input value={o.first} onChange={(e) => setOwner(idx, "first", e.target.value)} />
            </FormRow>
            <FormRow label="Priezvisko / názov">
              <Input value={o.last} onChange={(e) => setOwner(idx, "last", e.target.value)} />
            </FormRow>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: owners.length > 1 ? "1fr 130px" : "1fr", gap: 12 }}>
            <FormRow label="E-mail">
              <Input value={o.email || ""} onChange={(e) => setOwner(idx, "email", e.target.value)} />
            </FormRow>
            {owners.length > 1 && (
              <FormRow label="Podiel (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((o.share || 0) * 100)}
                  onChange={(e) => setOwner(idx, "share", (parseFloat(e.target.value) || 0) / 100)}
                />
              </FormRow>
            )}
          </div>

          <FormRow label="Rola" hint="Administrátor sa môže prihlásiť do aplikácie a spravovať dom, hlasovania a vlastníkov.">
            <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: 3, gap: 3 }}>
              {[
                { val: false, label: "Vlastník", icon: "user" },
                { val: true, label: "Administrátor", icon: "shield" },
              ].map((roleOpt) => (
                <button
                  key={String(roleOpt.val)}
                  type="button"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    background: !!o.admin === roleOpt.val ? "var(--primary)" : "transparent",
                    color: !!o.admin === roleOpt.val ? "#fff" : "var(--ink-soft)",
                  }}
                  onClick={() => setOwner(idx, "admin", roleOpt.val)}
                >
                  <Ic name={roleOpt.icon} size={15} />
                  {roleOpt.label}
                </button>
              ))}
            </div>
          </FormRow>

          {o.admin && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 12px 0", marginBottom: 14, background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--primary)", marginBottom: 10 }}>
                <Ic name="lock" size={14} /> Prihlasovacie údaje administrátora
              </div>
              <FormRow label="Prihlasovací e-mail" hint="Predvolene e-mail vlastníka.">
                <Input value={o.email || email} onChange={(e) => setOwner(idx, "email", e.target.value)} />
              </FormRow>
              <FormRow label="Heslo">
                <div style={{ display: "flex", gap: 8 }}>
                  <Input
                    value={o.password || ""}
                    onChange={(e) => setOwner(idx, "password", e.target.value)}
                    placeholder="Zadajte heslo alebo ho vygenerujte"
                    style={{ flex: 1 }}
                  />
                  <Btn kind="secondary" size="sm" icon="refresh" onClick={() => setOwner(idx, "password", genPassword())}>
                    Generovať
                  </Btn>
                </div>
              </FormRow>
            </div>
          )}
        </div>
      ))}
    </Modal>
  );
};
