# REELFORGE ENTERPRISE

# PROJECT_MAP.md

Version: 1.0

Project Owner:
Naveen Kumar

Chief Software Architect:
ChatGPT

Purpose:
This document defines the ownership and responsibility of every major folder and module in ReelForge Enterprise.

Every AI engineer must read this document before modifying files.

Never guess where code belongs.

Always follow this map.

---

# PROJECT STRUCTURE

ReelForgeEnterprise/

app/

components/

lib/

public/

supabase/

worker/

middleware.ts

next.config.js

package.json

---

# APP DIRECTORY

Purpose

Application routing.

Contains

Route Groups

API

SEO

Metadata

Public Pages

Dashboard

Authentication

Never place reusable UI here.

---

# ROUTE GROUPS

app/(marketing)

Purpose

Public marketing website.

Contains

Landing

Pricing

Affiliate

Support

Terms

Privacy

Refund

JVZoo

Bonus

Cancellation

Future

Order Bump

OTO Pages

Thank You

Never place dashboard logic here.

---

app/(dashboard)

Purpose

Application after login.

Contains

Dashboard

Movie Studio

Cartoon Studio

Marketing Studio

Projects

Assets

Billing

Credits

Settings

Profile

Subscriptions

Never place marketing pages here.

---

app/(auth)

Purpose

Authentication.

Contains

Login

Register

Forgot Password

Verify Email

Reset Password

Never place dashboard UI here.

---

app/api

Purpose

Backend API.

Contains

Server routes.

Payments.

AI.

Database.

Webhooks.

Authentication.

Never place UI here.

---

# COMPONENTS DIRECTORY

Purpose

Reusable UI.

Never place routing here.

---

components/ui

Enterprise Design System.

Contains

Buttons

Cards

Inputs

Typography

Sections

Containers

Badges

Pricing Cards

Feature Cards

Loading

Empty States

Every UI component must reuse this layer.

---

components/layouts

Purpose

Application layouts.

Contains

Marketing Layout

Dashboard Layout

Authentication Layout

Never place business logic here.

---

components/marketing

Purpose

Public marketing components.

Contains

Landing sections

Hero

Testimonials

Pricing preview

FAQ

Studio showcases

Marketing CTA

Announcement Bar

Only marketing UI belongs here.

---

components/funnel

Purpose

Sales Funnel Framework.

Contains

Offer Hero

Offer Card

Bonus Stack

Guarantee

Testimonials

Countdown

Progress

Checkout Summary

Trust Badges

CTA

Scarcity

Order Bump components

OTO components

Every sales page must reuse these components.

---

components/dashboard

Purpose

Dashboard UI.

Contains

Sidebar

Dashboard widgets

Statistics

Tables

Cards

Charts

Studio navigation

Dashboard-only components.

---

components/movie

Future

Movie Studio components.

---

components/cartoon

Future

Cartoon Studio components.

---

components/avatar

Future

Avatar Studio.

---

components/voice

Future

Voice Studio.

---

components/prompt

Future

Prompt Studio.

---

components/thumbnails

Future

Thumbnail Studio.

---

# LIB DIRECTORY

Purpose

Business logic.

Contains

Utilities

Helpers

Configuration

API clients

Pricing configuration

AI utilities

Never place UI here.

---

# PUBLIC DIRECTORY

Purpose

Static assets.

Contains

Images

Icons

Videos

Fonts

Logos

Downloads

Never place application logic here.

---

# SUPABASE

Purpose

Authentication

Database

Storage

Policies

Never modify without explicit engineering ticket.

---

# WORKER

Purpose

Background rendering.

Contains

FFmpeg

Video processing

Rendering queue

Background jobs

Never modify unless ticket requires it.

---

# GLOBAL OWNERSHIP

Marketing Team

components/marketing

Sales Team

components/funnel

Application Team

components/dashboard

Platform Team

app/api

Infrastructure Team

worker

Shared Engineering

components/ui

Shared Layouts

components/layouts

Business Logic

lib

Assets

public

---

# FILES THAT REQUIRE SPECIAL CARE

middleware.ts

Authentication flow

Route protection

Do not modify unless required.

---

next.config.js

Next.js configuration

Modify only when necessary.

---

package.json

Dependencies

Only modify if a new dependency is actually required.

---

tailwind.config

Design system

Never change colors without approval.

---

tsconfig.json

TypeScript

Modify only if architecture requires it.

---

# DESIGN OWNERSHIP

Enterprise Design System

Owner

components/ui

Sales Funnel

Owner

components/funnel

Marketing Website

Owner

components/marketing

Dashboard

Owner

components/dashboard

Authentication

Owner

app/(auth)

API

Owner

app/api

---

# CURRENT ENTERPRISE MODULES

Completed

Enterprise Design System

Premium Landing

Layout Architecture

Sales Funnel Framework

Pending

Pricing Center

Order Bump

OTO 1

OTO 2

OTO 3

OTO 4

Customer Portal

Affiliate Center

Admin Portal

Voice Studio

Avatar Studio

Thumbnail Studio

Prompt Studio

Podcast Studio

---

# GOLDEN RULES

Never duplicate components.

Never duplicate layouts.

Never duplicate pricing.

Never duplicate CTA logic.

Never hardcode pricing.

Never hardcode business rules.

Reuse Design System.

Reuse Funnel Framework.

Reuse Layout System.

Keep business logic inside lib.

Keep UI inside components.

Keep routing inside app.

Keep APIs inside app/api.

Keep rendering inside worker.

Keep static files inside public.

Always preserve architecture.

---

# ENGINEERING NAVIGATION

Before starting any task:

1. Read MASTER_ENGINEERING.md

2. Read AI_RULES.md

3. Read PROJECT_MAP.md

4. Read CHANGELOG_ENGINEERING.md

5. Read NEXT_SESSION.md

Only then implement the assigned engineering ticket.

Never inspect the repository unless a ticket explicitly requires it.

Follow this map instead of guessing where code belongs.

This document is the official navigation guide for the ReelForge Enterprise codebase.
