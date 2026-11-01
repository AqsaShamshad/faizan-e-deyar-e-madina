"use client";

import { useDeferredValue, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Check, ChevronDown, Copy, KeyRound, LoaderCircle, Pencil, Plus, Search, ShieldCheck, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  createTenantAccount,
  deleteTenantAccount,
  resetTenantPassword,
  setTenantStatus,
  updateTenantAccount,
} from "./actions";

type Tenant = {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  status: "ACTIVE" | "SUSPENDED";
  adminName: string;
  email: string;
  createdAt: string;
};

const formSchema = z.object({
  name: z.string().trim().min(2, "Enter the mosque name.").max(120),
  address: z.string().trim().max(300, "Address must be 300 characters or fewer."),
  contactNumber: z.string().trim().max(40, "Contact number must be 40 characters or fewer."),
  adminName: z.string().trim().min(2, "Enter an account name.").max(120),
  email: z.email("Enter a valid email address."),
  password: z.string().optional(),
});

type AccountFields = z.infer<typeof formSchema>;
type Props = { initialTenants: Tenant[] };

export function MosqueAccounts({ initialTenants }: Props) {
  const [tenants, setTenants] = useState(initialTenants);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [dialog, setDialog] = useState<"create" | "edit" | "reset" | null>(null);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [toast, setToast] = useState("");
  const [busy, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filtered = tenants.filter((tenant) => {
    const matchesSearch = `${tenant.name} ${tenant.address} ${tenant.contactNumber} ${tenant.email} ${tenant.id}`.toLowerCase().includes(deferredSearch);
    return matchesSearch && (filter === "ALL" || tenant.status === filter);
  });

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }

  function openCreate() {
    setSelected(null);
    setDialog("create");
  }

  function openEdit(tenant: Tenant) {
    setSelected(tenant);
    setDialog("edit");
  }

  function performStatus(tenant: Tenant) {
    startTransition(async () => {
      const status = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      const result = await setTenantStatus(tenant.id, status);
      if (!result.success) return notify(result.message);
      setTenants((items) => items.map((item) => item.id === tenant.id ? { ...item, status } : item));
      notify(result.message);
    });
  }

  function performDelete(tenant: Tenant) {
    if (!window.confirm(`Permanently delete ${tenant.name}, its administrator login, and all mosque data? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteTenantAccount(tenant.id);
      if (!result.success) return notify(result.message);
      setTenants((items) => items.filter((item) => item.id !== tenant.id));
      notify(result.message);
    });
  }

  return (
    <main className="admin-main">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">DIRECTORY / MOSQUES</p>
          <h1>Mosque accounts</h1>
          <p className="heading-copy">Manage screen access, mosque details, and administrator credentials.</p>
        </div>
        <button className="button button-primary" onClick={openCreate}>
          <Plus size={17} aria-hidden="true" /> Add mosque
        </button>
      </div>

      <div className="account-summary" aria-label="Account totals">
        <div className="summary-mark"><Building2 size={20} aria-hidden="true" /></div>
        <div><strong>{tenants.length}</strong><span>mosque accounts</span></div>
        <span className="summary-divider" aria-hidden="true" />
        <div><strong>{tenants.filter((tenant) => tenant.status === "ACTIVE").length}</strong><span>active screens</span></div>
        <div className="summary-note"><ShieldCheck size={15} aria-hidden="true" /> Super-admin workspace</div>
      </div>

      <section className="directory" aria-labelledby="directory-title">
        <div className="directory-header">
          <div><h2 id="directory-title">All mosques</h2><p>{filtered.length} {filtered.length === 1 ? "account" : "accounts"}</p></div>
          <div className="directory-controls">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search mosques</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mosque, email, or screen ID" />
              {search && <button type="button" className="clear-search" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}
            </label>
            <label className="filter-field">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span className="sr-only">Filter by status</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
              </select><ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </div>

        {filtered.length ? <div className="table-scroll"><table>
          <thead><tr><th scope="col">Mosque</th><th scope="col">Administrator</th><th scope="col">Screen ID</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{filtered.map((tenant) => <tr key={tenant.id}>
            <td><div className="mosque-cell"><span className="mosque-avatar">{tenant.name.slice(0, 1).toUpperCase()}</span><span><strong>{tenant.name}</strong><small>Added {new Date(tenant.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small>{tenant.address && <small className="mosque-details">{tenant.address}</small>}{tenant.contactNumber && <small className="mosque-details">{tenant.contactNumber}</small>}</span></div></td>
            <td><span className="admin-name">{tenant.adminName}</span><small className="table-subtext">{tenant.email}</small></td>
            <td><code className="slug-cell screen-id-cell">{tenant.id}</code></td>
            <td><span className={`status status-${tenant.status.toLowerCase()}`}><i aria-hidden="true" />{tenant.status === "ACTIVE" ? "Active" : "Suspended"}</span></td>
            <td><div className="row-actions">
              <button className="icon-button" title="Edit mosque" aria-label={`Edit ${tenant.name}`} onClick={() => openEdit(tenant)}><Pencil size={16} /></button>
              <button className="icon-button" title={tenant.status === "ACTIVE" ? "Suspend mosque" : "Reactivate mosque"} aria-label={tenant.status === "ACTIVE" ? `Suspend ${tenant.name}` : `Reactivate ${tenant.name}`} onClick={() => performStatus(tenant)} disabled={busy}><span className="sr-only">{tenant.status === "ACTIVE" ? "Suspend" : "Reactivate"}</span>{tenant.status === "ACTIVE" ? <ShieldCheck size={16} /> : <Check size={16} />}</button>
              <button className="icon-button icon-danger" title="Delete mosque" aria-label={`Delete ${tenant.name}`} onClick={() => performDelete(tenant)} disabled={busy}><Trash2 size={16} /></button>
            </div></td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state"><span><Building2 size={21} aria-hidden="true" /></span><h3>{tenants.length ? "No matching mosques" : "Your directory is ready"}</h3><p>{tenants.length ? "Try another name, email, address, or status." : "Add a mosque to create its screen address and administrator login."}</p>{!tenants.length && <button className="button button-secondary" onClick={openCreate}><Plus size={16} aria-hidden="true" /> Add first mosque</button>}</div>}
      </section>

      {dialog && <AccountDialog
        mode={dialog}
        tenant={selected}
        onClose={() => setDialog(null)}
        onSaved={(message, tenant, keepOpen) => {
          if (!message && dialog === "edit") {
            setDialog("reset");
            return;
          }
          if (tenant) setTenants((items) => dialog === "create" ? [tenant, ...items] : items.map((item) => item.id === tenant.id ? tenant : item));
          if (!keepOpen) setDialog(null);
          notify(message);
        }}
      />}
      <div className={`toast ${toast ? "toast-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </main>
  );
}

function AccountDialog({ mode, tenant, onClose, onSaved }: {
  mode: "create" | "edit" | "reset";
  tenant: Tenant | null;
  onClose: () => void;
  onSaved: (message: string, tenant?: Tenant, keepOpen?: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [delivery, setDelivery] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<AccountFields>({
    resolver: zodResolver(formSchema),
    defaultValues: tenant ? { name: tenant.name, address: tenant.address, contactNumber: tenant.contactNumber, adminName: tenant.adminName, email: tenant.email, password: "" } : { name: "", address: "", contactNumber: "", adminName: "", email: "", password: "" },
  });

  function submit(values: AccountFields) {
    setFormMessage("");
    startTransition(async () => {
      const input = { ...values, ...(mode === "create" ? { password } : {}) };
      const result = mode === "create" ? await createTenantAccount(input) : await updateTenantAccount(tenant!.id, input);
      if (!result.success) {
        setFormMessage(result.message);
        for (const [field, errors] of Object.entries(result.fieldErrors ?? {})) form.setError(field as keyof AccountFields, { message: errors?.[0] });
        return;
      }
      const savedTenant = { id: result.id ?? tenant?.id ?? "", name: values.name, address: values.address ?? "", contactNumber: values.contactNumber ?? "", status: tenant?.status ?? "ACTIVE" as const, adminName: values.adminName, email: values.email.toLowerCase(), createdAt: tenant?.createdAt ?? new Date().toISOString() };
      if (mode === "create" && result.screenUrl) {
        setDelivery({ url: result.screenUrl, emailSent: Boolean(result.emailSent) });
        onSaved(result.message, savedTenant, true);
        return;
      }
      onSaved(result.message, savedTenant);
    });
  }

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    startTransition(async () => {
      const result = await resetTenantPassword(tenant!.id, password);
      if (!result.success) return setFormMessage(result.message);
      onSaved(result.message);
    });
  }

  const title = mode === "create" ? "Add a mosque" : mode === "edit" ? "Edit mosque account" : "Reset administrator password";

  async function copyDeliveryLink() {
    if (!delivery) return;
    const url = delivery.url.startsWith("http") ? delivery.url : `${window.location.origin}${delivery.url}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setLinkCopied(false);
    }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-heading"><div><p className="eyebrow">{mode === "reset" ? "ACCOUNT SECURITY" : "MOSQUE DIRECTORY"}</p><h2 id="dialog-title">{title}</h2></div><button className="icon-button close-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
      {delivery ? <div className="account-form screen-delivery" role="status">
        <p className="dialog-copy">{delivery.emailSent ? "The screen link was emailed to the mosque administrator." : "The mosque account is ready, but email delivery is not configured or could not be completed."}</p>
        <div className="screen-address-preview"><code>{delivery.url}</code><button type="button" className="icon-button" onClick={copyDeliveryLink} aria-label="Copy screen link" title="Copy screen link">{linkCopied ? <Check size={15} /> : <Copy size={15} />}</button></div>
        <p className="field-hint">{linkCopied ? "Link copied." : delivery.emailSent ? "You can also copy this link for your records." : "Copy this link and send it to the administrator, or configure SMTP to email it automatically."}</p>
        <div className="dialog-actions"><button type="button" className="button button-primary" onClick={onClose}>Done</button></div>
      </div> : mode === "reset" ? <form onSubmit={submitPassword} className="account-form">
        <p className="dialog-copy">Set a new password for {tenant?.name}&apos;s administrator account.</p>
        <Field label="New password" name="new-password" error={formMessage} hint="At least 12 characters."><input autoComplete="new-password" type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={pending}>{pending && <LoaderCircle className="spin" size={16} />}Reset password</button></div>
      </form> : <form className="account-form" onSubmit={form.handleSubmit(submit)} noValidate>
        {formMessage && <p className="form-message" role="alert">{formMessage}</p>}
        <Field label="Mosque name" name="name" error={form.formState.errors.name?.message}><input autoFocus autoComplete="organization" {...form.register("name")} /></Field>
        <Field label="Address" name="address" error={form.formState.errors.address?.message}><input autoComplete="street-address" {...form.register("address")} /></Field>
        <Field label="Contact number" name="contactNumber" error={form.formState.errors.contactNumber?.message}><input type="tel" autoComplete="tel" {...form.register("contactNumber")} /></Field>
        <div className="form-grid"><Field label="Administrator name" name="adminName" error={form.formState.errors.adminName?.message}><input autoComplete="name" {...form.register("adminName")} /></Field><Field label="Email address" name="email" error={form.formState.errors.email?.message}><input type="email" autoComplete="email" {...form.register("email")} /></Field></div>
        {mode === "create" && <Field label="Temporary password" name="password" error={password.length > 0 && password.length < 12 ? "Use at least 12 characters." : undefined} hint="The administrator can use this to sign in immediately."><input required minLength={12} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>}
        <div className="dialog-actions">{mode === "edit" && <button type="button" className="button button-quiet password-reset" onClick={() => onSaved("", undefined)}><KeyRound size={15} />Reset password</button>}<span className="action-spacer" /><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={pending || (mode === "create" && password.length < 12)}>{pending && <LoaderCircle className="spin" size={16} />}{mode === "create" ? "Create account" : "Save changes"}</button></div>
      </form>}
    </section>
  </div>;
}

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label>{children}{error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</div>;
}
