export default function GlowBackground() {
  return (
    <>

      <div className="fixed inset-0 -z-50 overflow-hidden">

        <div className="absolute left-0 top-0 w-[700px] h-[700px] rounded-full bg-purple-600 opacity-20 blur-[180px]" />

        <div className="absolute right-0 bottom-0 w-[650px] h-[650px] rounded-full bg-orange-500 opacity-20 blur-[180px]" />

      </div>

    </>
  );
}