import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Target } from 'lucide-react';

const Homepage = () => {
  const principles = [
    '先定位一个目标，不做泛泛规划',
    '用证据补齐简历，不堆功能',
    '用面试反馈迭代，而不是凭感觉努力'
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#0b1220] px-4 py-16 text-white sm:px-6 lg:px-8">
      <section className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute bottom-8 right-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className="grid w-full gap-12 lg:grid-cols-[1.05fr_0.75fr] lg:items-center">
          <div>
            <div className="mb-8 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
              <Target className="mr-2 h-4 w-4" />
              职业增长系统
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              先找准方向，
              <span className="block bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                再提高胜率。
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              职向未来 Pro 只做一件事：把你的测评、岗位、简历和面试训练压缩成一条可执行路径，减少试错，提高求职转化。
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/assessment"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-7 py-4 text-base font-bold text-slate-950 shadow-[0_20px_60px_rgba(52,211,153,0.25)] transition hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                开始职业测评
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-7 py-4 text-base font-bold text-slate-200 transition hover:border-slate-400 hover:bg-white/5"
              >
                查看增长控制台
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-700 bg-slate-900/70 p-6 shadow-2xl backdrop-blur">
            <p className="mb-6 text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">System Logic</p>
            <div className="space-y-4">
              {principles.map((item, index) => (
                <div key={item} className="flex items-start gap-4 rounded-2xl border border-slate-700 bg-slate-950/50 p-5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-bold text-emerald-300">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-300" />
                      <p className="font-semibold text-white">{item}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {index === 0 && '没有目标岗位，后续优化都是噪音。'}
                      {index === 1 && '简历的本质是岗位匹配证据。'}
                      {index === 2 && '反馈越快，迭代越准。'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Homepage;
