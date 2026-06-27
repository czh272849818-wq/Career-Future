import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const Homepage = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-[#0b1220] px-4 py-12 text-white sm:px-6 lg:px-8">
      <section className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl items-center justify-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-12 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute bottom-10 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className="w-full max-w-5xl text-center">
          <h1 className="mx-auto max-w-5xl text-6xl font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
            你的人生
            <span className="block bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
              不止于此
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            把测评、岗位、简历和面试训练压缩成一条可执行路径，减少试错，提高求职转化。
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/assessment"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_20px_60px_rgba(52,211,153,0.25)] transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              开始职业测评
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-8 py-4 text-base font-bold text-slate-200 transition hover:border-slate-400 hover:bg-white/5"
            >
              查看增长控制台
            </Link>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 text-sm text-slate-400">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">测评定位</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">岗位聚焦</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">面试转化</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Homepage;
