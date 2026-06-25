"use client";

import Link from "next/link";
import Button from "../ui/button";
import Container from "../shared/Container";

export default function Header() {

  return (

<header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">

<Container>

<div className="flex items-center justify-between h-20">

<Link href="/" className="flex items-center gap-3">

<img
src="/logos/logo.png"
className="h-11"
alt="ReelForge"
/>

<div>

<h2 className="font-black text-2xl tracking-tight">

<span className="text-white">REEL</span>

<span className="text-orange-500">FORGE</span>

</h2>

<p className="text-xs text-zinc-400">

AI Movie Studio

</p>

</div>

</Link>

<nav className="hidden lg:flex items-center gap-8 text-sm">

<Link href="/">Home</Link>

<Link href="/pricing">Pricing</Link>

<Link href="/affiliates">Affiliates</Link>

<Link href="/support">Support</Link>

<Link href="/dashboard">Dashboard</Link>

</nav>

<div className="flex gap-3">

<Button
variant="outline"
href="/login"
>

Login

</Button>

<Button
href="/register"
>

Start Free

</Button>

</div>

</div>

</Container>

</header>

  );
}