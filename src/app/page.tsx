import Shell from "@/components/site/Shell";
import Nav from "@/components/site/Nav";
import Hero from "@/components/site/Hero";
import Marquee from "@/components/site/Marquee";
import Services from "@/components/site/Services";
import RoiCalc from "@/components/site/RoiCalc";
import About from "@/components/site/About";
import Testimonials from "@/components/site/Testimonials";
import Team from "@/components/site/Team";
import Tools from "@/components/site/Tools";
import Contact from "@/components/site/Contact";
import Footer from "@/components/site/Footer";

export default function Home() {
  return (
    <Shell>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Services />
        <RoiCalc />
        <About />
        <Testimonials />
        <Team />
        <Tools />
        <Contact />
      </main>
      <Footer />
    </Shell>
  );
}
