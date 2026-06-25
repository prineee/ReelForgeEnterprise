import Container from "../shared/Container";

export default function Footer() {

return (

<footer className="border-t border-white/10 mt-32">

<Container>

<div className="py-20 grid lg:grid-cols-4 gap-12">

<div>

<img
src="/logos/logo.png"
className="h-14 mb-5"
/>

<p className="text-zinc-400">

Create AI Movies,

Animated Films,

Talking Character Videos,

and Viral Shorts.

</p>

</div>

<div>

<h3 className="font-bold mb-5">

Product

</h3>

<ul className="space-y-3 text-zinc-400">

<li>Movie Studio</li>

<li>Cartoon Studio</li>

<li>Dialogue Studio</li>

<li>Pricing</li>

</ul>

</div>

<div>

<h3 className="font-bold mb-5">

Company

</h3>

<ul className="space-y-3 text-zinc-400">

<li>Affiliate Program</li>

<li>Support</li>

<li>Privacy</li>

<li>Terms</li>

</ul>

</div>

<div>

<h3 className="font-bold mb-5">

Newsletter

</h3>

<p className="text-zinc-400 mb-4">

Get AI updates and launch offers.

</p>

<input

placeholder="Email"

className="w-full rounded-xl bg-zinc-900 border border-white/10 px-4 py-3 mb-3"

/>

<button className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-purple-600 py-3">

Subscribe

</button>

</div>

</div>

<div className="border-t border-white/10 py-8 text-center text-zinc-500">

© {new Date().getFullYear()} ReelForge AI Studio

</div>

</Container>

</footer>

);

}