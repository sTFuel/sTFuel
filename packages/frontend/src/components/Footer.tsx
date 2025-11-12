const Footer = () => {
  return (
    <footer className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 mt-16">
      <div className="flex flex-col items-center gap-4 border-theta-top py-8 text-center sm:flex-row sm:justify-between">
        <p className="text-sm text-gray-color">© {new Date().getFullYear()} sTFuel Protocol. All rights reserved.</p>
        <div className="flex items-center gap-4 text-gray-color ">
          <a className="hover:text-white transition-colors" href="/whitepaper" target="_blank" rel="noopener noreferrer">
            Whitepaper
          </a>
          <a className="hover:text-white transition-colors" href="/terms-of-service">
            Terms
          </a>
          <a className="hover:text-white transition-colors" href="/privacy-policy">
            Privacy
          </a>
          <a className="hover:text-white transition-colors" href="https://x.com/sTFuel" target="_blank" rel="noopener noreferrer">
            Twitter
          </a>
          <a className="hover:text-white transition-colors" href="https://discord.gg/ydnAHjJppw" target="_blank" rel="noopener noreferrer">
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
