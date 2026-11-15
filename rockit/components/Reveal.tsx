"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export default function Reveal({children}:{children:React.ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  gsap.registerPlugin(ScrollTrigger);
  const media=gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)",()=>{
   if(!ref.current)return;
   const context=gsap.context(()=>{
    gsap.fromTo(ref.current,{opacity:0,y:14},{opacity:1,y:0,duration:.55,ease:"power2.out"});
    gsap.utils.toArray<HTMLElement>(".result-card,.ml-intro,.twin-comparison").forEach(el=>gsap.fromTo(el,{opacity:.75,y:16},{opacity:1,y:0,duration:.55,ease:"power2.out",scrollTrigger:{trigger:el,start:"top 94%",once:true}}));
   },ref);
   return()=>context.revert();
  });
  return()=>media.revert();
 },[]);
 return <div ref={ref}>{children}</div>;
}
