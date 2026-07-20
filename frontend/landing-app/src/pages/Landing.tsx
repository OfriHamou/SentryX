import HeroSection from '../components/landing/HeroSection';
import AppCardsSection from '../components/landing/AppCardsSection';
import CapabilitiesSection from '../components/landing/CapabilitiesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import FooterSection from '../components/landing/FooterSection';
import RevealSection from '../components/landing/RevealSection';

export default function Landing() {
    return (
        <>
            <HeroSection />
            <RevealSection><AppCardsSection /></RevealSection>
            <RevealSection><CapabilitiesSection /></RevealSection>
            <RevealSection><HowItWorksSection /></RevealSection>
            <FooterSection />
        </>
    );
}