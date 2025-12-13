'use client';
import { useState, useEffect } from 'react';

export default function WhitePaperPage() {
  const [animatedWord, setAnimatedWord] = useState('smart');
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const words = ['mart', 'taked'];
  const currentWordIndex = currentIndex % words.length;
  const currentWord = words[currentWordIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isDeleting) {
        setAnimatedWord(currentWord.substring(0, animatedWord.length - 1));
        if (animatedWord.length === 0) {
          setIsDeleting(false);
          setCurrentIndex(prev => prev + 1);
        }
      } else {
        setAnimatedWord(currentWord.substring(0, animatedWord.length + 1));
        if (animatedWord === currentWord) {
          setTimeout(() => setIsDeleting(true), 2000); // Pause before deleting
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [animatedWord, isDeleting, currentWord]);

  // Cursor blinking effect
  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorTimer);
  }, []);

  const keyFacts = [
    {
      number: 1,
      title: "100% TFuel Backing",
      description: (
        <>
          Every sTFuel token is fully backed by <span className="text-tfuel-color font-semibold">TFuel</span>. 
          The backing amount can only <span className="text-secondary-color font-semibold">increase</span>, 
          never decrease, ensuring your tokens always have <span className="text-theta-color font-semibold">real value</span>.
        </>
      )
    },
    {
      number: 2,
      title: "Automated Staking & Compounding",
      description: (
        <>
          Your TFuel is <span className="text-theta-color font-semibold">automatically</span> pooled and staked when available, 
          with rewards <span className="text-secondary-color font-semibold">automatically compounded</span> back into the protocol 
          for <span className="text-tfuel-color font-semibold">maximum growth</span>.
        </>
      )
    },
    {
      number: 3,
      title: "No Minimum Staking",
      description: (
        <>
          Unlike traditional staking, there's <span className="text-tfuel-color font-semibold">no minimum</span> amount required. 
          Pool your TFuel with others to participate in staking rewards <span className="text-theta-color font-semibold">regardless</span> of your holdings.
        </>
      )
    },
    {
      number: 4,
      title: "Stay Liquid & Tradeable",
      description: (
        <>
          Keep your <span className="text-secondary-color font-semibold">liquidity</span> while earning rewards. 
          Trade sTFuel on <span className="text-theta-color font-semibold">ThetaSwap</span> or use it as liquidity pairs - 
          your tokens work for you <span className="text-tfuel-color font-semibold">without being locked up</span>.
        </>
      )
    },
    {
      number: 5,
      title: "Simplified Tracking",
      description: (
        <>
          No more daily transaction spam in your wallet. Simply track your sTFuel value increase - <span className="text-theta-color font-semibold">one token</span>, <span className="text-secondary-color font-semibold">clear value</span>, <span className="text-tfuel-color font-semibold">easy monitoring</span>.
        </>
      )
    },
    {
      number: 6,
      title: "Gamified Protocol Maintenance",
      description: (
        <>
          Withdrawal fees fund <span className="text-tfuel-color font-semibold">keeper tips</span>, 
          incentivizing users to maintain the protocol. Unused fees boost the backing pool, <span className="text-secondary-color font-semibold">benefiting all holders</span>.
        </>
      )
    },
    {
      number: 7,
      title: "Audited & Secure",
      description: (
        <>
          Our smart contracts are <span className="text-theta-color font-semibold">publicly audited</span> and transparent. 
          Security is paramount - your assets are protected by <span className="text-tfuel-color font-semibold">battle-tested</span>, <span className="text-secondary-color font-semibold">verified code</span>.
        </>
      )
    },
    {
      number: 8,
      title: "Community Driven",
      description: (
        <>
          Earn with Referral! Owning an <a href="https://opentheta.io/collection/oties" target="_blank" rel="noopener noreferrer" className="text-tfuel-color font-semibold hover:underline">Oties NFT</a> enables you to create your own referral link, and earning <span className="text-secondary-color font-semibold">20% of the fee</span> paid by the minter! 
          <span className="text-theta-color font-semibold"> Spread the word and earn!</span>
        </>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-12">
      {/* Hero Section */}
      <section className="text-center">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-white text-4xl font-black leading-tight tracking-tighter md:text-5xl">
            <span className="text-tfuel-color">s</span>
            <span className="text-tfuel-color">
              {animatedWord}
              <span className={`inline-block w-0.5 h-8 bg-tfuel ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'}`}>
                |
              </span>
              <span className="text-white"> TFuel White Paper</span>
            </span>
          </h1>
          <h2 className="text-text-secondary-dark text-base font-normal leading-normal max-w-2xl md:text-lg text-gray-color">
            The Liquid Staking Solution for <span className="text-tfuel-color">TFuel</span>
          </h2>
          <a
            href="https://www.notion.so/opentheta/Smart-TFuel-sTFuel-White-Paper-2961c383346f8072adbbfb8fba344c70?source=copy_link"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 button-tfuel-color text-white text-base font-bold shadow-[0_0_15px_rgba(236,136,53,0.6)] transition-all hover:shadow-[0_0_25px_rgba(236,136,53,0.8)]"
          >
            <span className="truncate">Read White Paper</span>
          </a>
        </div>
      </section>

      {/* Explainer Video Section */}
      <section className="text-center">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-white text-3xl font-bold">
            How sTFuel Works
          </h2>
          <div className="w-full max-w-4xl">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src="https://player.vimeo.com/video/1141297449"
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="sTFuel Explainer Video"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Key Facts Section */}
      <section>
        <div className="flex flex-col gap-8">
          <h2 className="text-white text-3xl font-bold text-center">
            Key Facts:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {keyFacts.map((fact, index) => (
              <div
                key={fact.number}
                className={`rounded-xl border border-border-dark/50 bg-card-dark p-6 hover:shadow-[0_0_20px_rgba(236,136,53,0.3)] transition-all duration-300 ${
                  index === 8 ? 'md:col-span-2' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-tfuel flex items-center justify-center text-white font-bold text-sm">
                      {fact.number}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white text-lg font-bold mb-2">
                      {fact.title}
                    </h3>
                    <p className="text-text-secondary-dark text-sm leading-relaxed">
                      {fact.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <span className="block text-text-secondary-dark text-sm text-center mt-4 text-gray-color">
            <span className="font-bold">Disclaimer:</span> This is not financial or investment advice. Use at your own risk.
            Smart contracts, including those for liquid staking and DeFi, always carry certain security risks.
            Please do your own research before using these solutions.
          </span>
        </div>
      </section>
    </div>
  );
}
