# REELFORGE ENTERPRISE

## MASTER_ENGINEERING.md

Version: 1.0

Project Owner: Naveen Kumar

Chief Software Architect: ChatGPT

Last Updated: 26 June 2026

---

# PROJECT VISION

ReelForge is an Enterprise AI SaaS platform.

It is NOT a simple AI Video Generator.

Its mission is to become:

• Canva for AI Movies
• CapCut for AI Video Creation
• Midjourney for AI Storytelling

The platform must be commercially deployable, scalable, maintainable, and enterprise-grade.

Every engineering decision should support long-term scalability.

---

# TECHNOLOGY STACK

Frontend

* Next.js 14
* React 18
* TypeScript
* TailwindCSS

Backend

* Node.js
* API Routes

Authentication

* Supabase Auth

Database

* Supabase

Storage

* Cloudinary

Payments

* Razorpay
* Stripe

Video

* FFmpeg

Deployment

* Vercel

Repository

* GitHub

IDE

* Visual Studio Code

Primary AI Coding Assistant

* Gemini Code Assist

Architecture Planner

* ChatGPT

---

# DESIGN LANGUAGE

Theme

Black

Orange

Purple Glow

Blue Accent

Glass Morphism

Rounded Components

Soft Shadows

Premium Motion

Typography

Inter

No placeholder UI.

No unfinished designs.

Every page must look commercially deployable.

---

# ARCHITECTURE

The application is divided into independent layout families.

Marketing Layout

Purpose

Public website

Includes

Landing

Pricing

Affiliate

Support

Legal Pages

Sales Funnel

Dashboard Layout

Purpose

Application

Includes

Dashboard

Movie Studio

Cartoon Studio

Marketing Studio

Projects

Assets

Billing

Credits

Settings

Auth Layout

Purpose

Authentication

Includes

Login

Register

Forgot Password

Reset Password

Verify Email

Root Layout

Only

HTML

Metadata

Global Background

Children

No Header

No Footer

---

# ENTERPRISE DESIGN SYSTEM

Completed

Shared UI Components

Shared Layout Components

Design Tokens

Button System

Glass Cards

Typography

Containers

Sections

Badges

Pricing Cards

Feature Cards

Loading States

Empty States

All UI must reuse existing design system.

Never duplicate components.

---

# SALES FUNNEL FRAMEWORK

Completed

Reusable Components

Offer Hero

Offer Card

Bonus Stack

Guarantee Box

Countdown Banner

Sticky Purchase Bar

Feature Checklist

Pricing Comparison

Testimonials

FAQ

Checkout Summary

Offer Progress

Trust Badges

Floating CTA

Every funnel page must reuse these components.

Never duplicate funnel UI.

---

# BUSINESS MODEL

Frontend Product

ReelForge AI Movie Studio

$29

Order Bump

AI Prompt Vault

$17

OTO 1

ReelForge PRO

$67

OTO 2

Agency License

$197

OTO 3

AI Content Vault

$97

OTO 4

VIP Membership

$19/month

Future upgrades must reuse these plans.

No hardcoded pricing inside UI components.

---

# CURRENT PROJECT STATUS

Completed

Project Stabilization

Enterprise Design System

Landing Page

Route Layout System

Sales Funnel Framework

Premium Landing

Build System

Vercel Compatibility

Pending

Pricing Center

Order Bump

OTO 1

OTO 2

OTO 3

OTO 4

Customer Portal

Affiliate Center 2.0

Admin Portal

Voice Studio

Avatar Studio

Thumbnail Studio

Prompt Studio

Podcast Studio

---

# CODING PRINCIPLES

Always preserve working code.

Never redesign completed modules.

Never rename files without necessity.

Never duplicate logic.

Always compose reusable components.

Always preserve SEO.

Always preserve accessibility.

Always preserve performance.

Always use TypeScript.

Always keep components small.

Always keep business logic separated from UI.

Never hardcode business data.

Prefer configuration-driven architecture.

---

# AI ENGINEERING RULES

Never inspect the repository unless explicitly instructed.

Never scan unrelated folders.

Never modify unrelated files.

Never refactor outside the requested scope.

Never move routes unless requested.

Never change authentication.

Never change payment integrations unless requested.

Never change API routes unless requested.

Never redesign existing pages.

Always use the existing Design System.

Always use the existing Layout System.

Always use the existing Funnel Framework.

Only modify files required for the current engineering ticket.

Run npm run build only when routing or compilation is affected.

If only UI changes are made, avoid unnecessary builds.

Report only:

Files Created

Files Modified

Summary

---

# FOLDER OWNERSHIP

Marketing

components/marketing

Dashboard

components/dashboard

Shared UI

components/ui

Shared Layouts

components/layouts

Sales Funnel

components/funnel

Authentication

app/(auth)

Marketing Routes

app/(marketing)

Dashboard Routes

app/(dashboard)

API

app/api

Worker

worker/

Never mix responsibilities.

---

# ENGINEERING TICKETS

RF-001

Enterprise Design System

Status

Completed

RF-002

Premium Landing Page

Status

Completed

RF-003

Layout Architecture

Status

Completed

RF-004

Sales Funnel Framework

Status

Completed

RF-005

Enterprise Pricing Center

Status

Pending

RF-006

Order Bump

Status

Pending

RF-007

OTO 1

Status

Pending

RF-008

OTO 2

Status

Pending

RF-009

OTO 3

Status

Pending

RF-010

OTO 4

Status

Pending

RF-011

Customer Portal

Status

Pending

RF-012

Affiliate Center 2.0

Status

Pending

RF-013

Admin Portal

Status

Pending

RF-014

AI Studio Expansion

Status

Pending

---

# DEFINITION OF DONE

A task is complete only when:

The feature is production-ready.

TypeScript passes.

Build passes if required.

No duplicate code exists.

Design System is reused.

Layout System is preserved.

Accessibility is maintained.

Performance is maintained.

Architecture remains clean.

No existing functionality is broken.

---

# PROJECT PHILOSOPHY

ReelForge is not being built as a demo.

Every implementation should be suitable for a commercial SaaS serving thousands of users.

Long-term maintainability takes precedence over short-term convenience.

When multiple solutions are possible, prefer the one that reduces technical debt, encourages reuse, and fits the existing architecture.
