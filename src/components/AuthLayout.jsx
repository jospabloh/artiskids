import React from "react";

// Brand layout for the auth screens -- two columns on desktop: the form on
// the left, an ArtisKids brand panel on the right (hidden on mobile). Same
// skeleton as the rest of the ACACIA portfolio (see stockflow/flowfin's own
// AuthLayout.jsx): logo lockup + icon badge + title + children + footer on
// the left, a gradient panel with an eyebrow badge + headline on the right --
// with ArtisKids' own identity, palette and copy, not a generic placeholder.
export default function AuthLayout({ icon: Icon, title, subtitle = null, footer = null, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-2">
      {/* Form column */}
      <div className="flex min-h-screen flex-col px-6 py-8 lg:min-h-0 lg:px-12">
        <a href="/" className="flex items-center gap-2.5 text-lg font-heading font-bold tracking-tight text-foreground">
          <img src="/logo.jpg" alt="ArtisKids" className="h-9 w-9 rounded-xl object-cover shadow-sm" />
          ArtisKids
        </a>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-7 text-center">
            {Icon && (
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
                <Icon className="h-6 w-6 text-amber-600" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-2xl font-heading font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
        </div>

        <p className="text-center text-xs text-muted-foreground">ArtisKids · Cápsula de arte</p>
      </div>

      {/* Brand panel (desktop) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-amber-200/40 via-amber-50 to-background lg:block">
        <div className="absolute inset-0 flex flex-col justify-center px-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
            Dibujos de tus hijos · para siempre
          </span>
          <h2 className="mt-5 text-4xl font-heading font-bold leading-tight text-stone-800">
            Cada dibujo, guardado
            <br />
            <span className="text-amber-600">para siempre</span>.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-stone-500">
            Sube las creaciones de tus hijos, coméntalas en familia y
            consérvalas en una cápsula que no se pierde ni se borra.
          </p>
        </div>
      </div>
    </div>
  );
}
