'use client';

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <section className="text-center">
        <h1 className="text-white text-4xl font-black leading-tight tracking-tighter md:text-5xl mb-4">
          Terms of Service
        </h1>
        <p className="text-text-secondary-dark text-base font-normal leading-normal md:text-lg text-gray-color">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </section>

      {/* Content */}
      <section className="flex flex-col gap-6 text-gray-color">
        <div className="rounded-xl border border-border-dark/50 bg-card-dark p-6 sm:p-8">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-white text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4 leading-relaxed">
              By accessing, using, or interacting with the sTFuel Protocol ("Protocol"), its smart contracts, website, 
              or any related services (collectively, the "Services"), you ("User", "you", or "your") acknowledge that 
              you have read, understood, and agree to be bound by these Terms of Service ("Terms"). If you do not agree 
              to these Terms, you must not use the Services.
            </p>
            <p className="mb-4 leading-relaxed">
              These Terms constitute a legally binding agreement between you and the Protocol. The Protocol is a 
              decentralized autonomous protocol operating on blockchain networks. The Node Operator, OpenTheta AG 
              ("OpenTheta AG", "Node Operator"), a Swiss company established in Baar, Zug, Switzerland, operates 
              certain infrastructure nodes but does not control or operate the Protocol itself.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">2. Description of Services</h2>
            <p className="mb-4 leading-relaxed">
              The sTFuel Protocol is a decentralized liquid staking protocol that allows users to stake TFuel tokens 
              and receive sTFuel tokens in return. The Protocol operates through smart contracts deployed on blockchain 
              networks. The Protocol is non-custodial, meaning you retain control of your assets through your wallet.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Important:</strong> The Protocol is experimental software operating on blockchain networks. 
              Use of the Protocol involves substantial risk of loss, including but not limited to total loss of funds.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">3. No Warranties</h2>
            <p className="mb-4 leading-relaxed">
              THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR 
              IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Warranties of merchantability, fitness for a particular purpose, or non-infringement</li>
              <li>Warranties that the Services will be uninterrupted, secure, error-free, or free from viruses or harmful components</li>
              <li>Warranties regarding the accuracy, reliability, or completeness of any information provided</li>
              <li>Warranties that the Protocol will operate as intended or produce any specific results</li>
              <li>Warranties regarding the availability, performance, or uptime of blockchain networks or node infrastructure</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              Neither the Protocol developers, OpenTheta AG, nor any other party involved in the Protocol makes any 
              representations or warranties regarding the Services.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">4. Limitation of Liability</h2>
            <h3 className="text-white text-xl font-semibold mb-3 mt-6">4.1 General Limitation</h3>
            <p className="mb-4 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY SWISS LAW, NEITHER THE PROTOCOL DEVELOPERS, OPENTHETA AG, NOR ANY OF 
              THEIR RESPECTIVE DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, AFFILIATES, OR REPRESENTATIVES SHALL BE LIABLE 
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, 
              DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Your use or inability to use the Services</li>
              <li>Any unauthorized access to or use of your wallet, private keys, or funds</li>
              <li>Any errors or omissions in the Services or smart contracts</li>
              <li>Any interruption or cessation of transmission to or from the Services</li>
              <li>Any bugs, viruses, trojan horses, or the like, which may be transmitted to or through the Services</li>
              <li>Any loss or damage of any kind incurred as a result of your use of the Services</li>
            </ul>

            <h3 className="text-white text-xl font-semibold mb-3 mt-6">4.2 Specific Exclusions</h3>
            <p className="mb-4 leading-relaxed">
              <strong>Loss of Funds:</strong> The Protocol developers and OpenTheta AG shall not be liable for any loss 
              of funds, tokens, or other digital assets, whether resulting from:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Smart contract bugs, vulnerabilities, or exploits</li>
              <li>Hacking, phishing, or other security breaches</li>
              <li>User error, including but not limited to sending funds to incorrect addresses, losing private keys, or sharing sensitive information</li>
              <li>Market volatility or changes in token prices</li>
              <li>Regulatory actions or changes in law</li>
              <li>Forks, network upgrades, or changes to underlying blockchain protocols</li>
            </ul>

            <p className="mb-4 leading-relaxed">
              <strong>Node Operations:</strong> OpenTheta AG, as a Node Operator, shall not be liable for:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Node downtime, failures, or unavailability</li>
              <li>Delays in processing transactions or smart contract interactions</li>
              <li>Incorrect or incomplete data provided by nodes</li>
              <li>Network connectivity issues or blockchain network congestion</li>
              <li>Any consequences resulting from nodes not running, being offline, or experiencing technical difficulties</li>
              <li>Loss of staking rewards due to node failures or operational issues</li>
              <li>Any damages arising from the operation, maintenance, or discontinuation of node infrastructure</li>
            </ul>

            <p className="mb-4 leading-relaxed">
              <strong>Protocol Functionality:</strong> The Protocol developers shall not be liable for:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Protocol failures, bugs, or unintended behavior</li>
              <li>Inability to mint, redeem, or transfer tokens</li>
              <li>Changes in exchange rates, staking rewards, or protocol parameters</li>
              <li>Loss of value of sTFuel tokens relative to TFuel or other assets</li>
              <li>Any consequences of protocol upgrades, modifications, or discontinuation</li>
            </ul>

            <h3 className="text-white text-xl font-semibold mb-3 mt-6">4.3 Maximum Liability</h3>
            <p className="mb-4 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY SWISS LAW, THE TOTAL LIABILITY OF THE PROTOCOL DEVELOPERS AND OPENTHETA 
              AG, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, SHALL NOT EXCEED ZERO (0) SWISS FRANCS (CHF 0.00).
            </p>
            <p className="mb-4 leading-relaxed">
              This limitation applies even if the Protocol developers or OpenTheta AG have been advised of the possibility 
              of such damages and regardless of the theory of liability (contract, tort, or otherwise).
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">5. Assumption of Risk</h2>
            <p className="mb-4 leading-relaxed">
              You acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li><strong>Cryptocurrency and Blockchain Risks:</strong> Cryptocurrency and blockchain technology involve substantial risk. The value of digital assets can be extremely volatile, and you may lose all or a substantial portion of your investment.</li>
              <li><strong>Smart Contract Risks:</strong> Smart contracts are experimental technology and may contain bugs, vulnerabilities, or unintended behavior that could result in loss of funds.</li>
              <li><strong>Regulatory Risks:</strong> The regulatory environment for cryptocurrencies and DeFi protocols is uncertain and may change, potentially affecting the Protocol's operation or legality in your jurisdiction.</li>
              <li><strong>Technical Risks:</strong> Blockchain networks may experience congestion, forks, or other technical issues that could affect the Protocol's operation.</li>
              <li><strong>Node Infrastructure Risks:</strong> Node infrastructure may experience downtime, failures, or operational issues that could affect your ability to interact with the Protocol or receive staking rewards.</li>
              <li><strong>Liquidity Risks:</strong> There is no guarantee of liquidity for sTFuel tokens, and you may not be able to sell or redeem your tokens at desired prices or times.</li>
              <li><strong>Staking Risks:</strong> Staking rewards are not guaranteed and may vary based on network conditions, node performance, and other factors beyond anyone's control.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              You expressly acknowledge and assume all risks associated with using the Services.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">6. User Responsibilities</h2>
            <p className="mb-4 leading-relaxed">
              You are solely responsible for:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Maintaining the security and confidentiality of your wallet, private keys, seed phrases, and any other authentication credentials</li>
              <li>All transactions initiated from your wallet, whether authorized by you or not</li>
              <li>Verifying the accuracy of transaction details before confirming</li>
              <li>Understanding the risks associated with cryptocurrency, blockchain technology, and DeFi protocols</li>
              <li>Compliance with all applicable laws and regulations in your jurisdiction</li>
              <li>Paying any taxes or fees that may apply to your use of the Services</li>
              <li>Ensuring that your use of the Services does not violate any laws or regulations applicable to you</li>
              <li>Not using the Services for any illegal or unauthorized purpose</li>
            </ul>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">7. No Financial Advice</h2>
            <p className="mb-4 leading-relaxed">
              The Services do not constitute financial, investment, legal, or tax advice. Nothing in the Services should 
              be construed as a recommendation to buy, sell, or hold any digital asset. You should consult with qualified 
              financial, legal, and tax advisors before making any decisions regarding the Services.
            </p>
            <p className="mb-4 leading-relaxed">
              The Protocol developers and OpenTheta AG do not provide investment advice, and any information provided 
              through the Services is for informational purposes only.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">8. Indemnification</h2>
            <p className="mb-4 leading-relaxed">
              You agree to indemnify, defend, and hold harmless the Protocol developers, OpenTheta AG, and their 
              respective directors, officers, employees, agents, affiliates, and representatives from and against any 
              and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable 
              attorneys' fees) arising from:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Your use of or access to the Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or regulation</li>
              <li>Your infringement of any rights of any third party</li>
              <li>Any transactions you initiate or authorize</li>
            </ul>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">9. Force Majeure</h2>
            <p className="mb-4 leading-relaxed">
              Neither the Protocol developers nor OpenTheta AG shall be liable for any failure or delay in performance 
              under these Terms resulting from circumstances beyond their reasonable control, including but not limited to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Acts of God, natural disasters, or extreme weather events</li>
              <li>War, terrorism, or civil unrest</li>
              <li>Government actions, regulations, or restrictions</li>
              <li>Blockchain network failures, forks, or attacks</li>
              <li>Internet or telecommunications failures</li>
              <li>Cyberattacks, hacking, or security breaches affecting third-party services</li>
              <li>Pandemics, epidemics, or public health emergencies</li>
              <li>Any other event that is beyond the reasonable control of the parties</li>
            </ul>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">10. Protocol Modifications and Discontinuation</h2>
            <p className="mb-4 leading-relaxed">
              The Protocol developers reserve the right to modify, upgrade, or discontinue the Protocol or any part 
              thereof at any time, with or without notice. OpenTheta AG reserves the right to modify, suspend, or 
              discontinue node operations at any time, with or without notice.
            </p>
            <p className="mb-4 leading-relaxed">
              Neither the Protocol developers nor OpenTheta AG shall be liable for any consequences resulting from 
              such modifications, upgrades, or discontinuations.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">11. Third-Party Services</h2>
            <p className="mb-4 leading-relaxed">
              The Services may integrate with or rely on third-party services, including wallet providers, blockchain 
              networks, and other infrastructure providers. The Protocol developers and OpenTheta AG are not responsible 
              for the availability, accuracy, or reliability of any third-party services. Your use of third-party 
              services is subject to their respective terms of service and privacy policies.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">12. Prohibited Uses</h2>
            <p className="mb-4 leading-relaxed">
              You agree not to use the Services:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>In any way that violates any applicable law or regulation</li>
              <li>To engage in any fraudulent, deceptive, or illegal activity</li>
              <li>To interfere with or disrupt the Services or any servers or networks connected to the Services</li>
              <li>To attempt to gain unauthorized access to any part of the Services</li>
              <li>To transmit any viruses, malware, or other harmful code</li>
              <li>To exploit any bugs or vulnerabilities in the Protocol or smart contracts</li>
              <li>For any purpose that is harmful to the Protocol or its users</li>
            </ul>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">13. Intellectual Property</h2>
            <p className="mb-4 leading-relaxed">
              The Protocol's smart contracts are open-source and may be subject to their respective licenses. The 
              website, documentation, and other materials may be protected by copyright and other intellectual property 
              laws. You may not copy, modify, distribute, or create derivative works without proper authorization.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">14. Severability</h2>
            <p className="mb-4 leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid under Swiss law, such provision 
              shall be modified to the minimum extent necessary to make it enforceable, or if modification is not 
              possible, it shall be severed from these Terms. The remaining provisions shall remain in full force and effect.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">15. Entire Agreement</h2>
            <p className="mb-4 leading-relaxed">
              These Terms, together with the Privacy Policy, constitute the entire agreement between you and the Protocol 
              regarding your use of the Services and supersede all prior or contemporaneous agreements, understandings, 
              or communications.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">16. Changes to Terms</h2>
            <p className="mb-4 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by 
              posting the updated Terms on this page and updating the "Last updated" date. Your continued use of the 
              Services after such modifications constitutes your acceptance of the updated Terms.
            </p>
            <p className="mb-4 leading-relaxed">
              If you do not agree to the modified Terms, you must discontinue use of the Services immediately.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">17. Governing Law and Jurisdiction</h2>
            <p className="mb-4 leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of Switzerland, without regard to 
              its conflict of law provisions.
            </p>
            <p className="mb-4 leading-relaxed">
              Any disputes arising from or in connection with these Terms or your use of the Services shall be subject 
              to the exclusive jurisdiction of the competent courts of Zug, Switzerland.
            </p>
            <p className="mb-4 leading-relaxed">
              This choice of law and jurisdiction applies to the maximum extent permitted by law, including mandatory 
              consumer protection laws that may provide for different governing law or jurisdiction.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">18. Contact Information</h2>
            <p className="mb-4 leading-relaxed">
              If you have any questions about these Terms, please contact:
            </p>
            <div className="bg-background-dark p-4 rounded-lg mb-4">
              <p className="mb-2"><strong>Node Operator:</strong></p>
              <p className="mb-2">OpenTheta AG</p>
              <p className="mb-2">Baar, Zug, Switzerland</p>
              <p className="mb-2">Email: contact@opentheta.io</p>
            </div>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">19. Acknowledgment</h2>
            <p className="mb-4 leading-relaxed">
              BY USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS. 
              YOU FURTHER ACKNOWLEDGE THAT YOU UNDERSTAND THE RISKS ASSOCIATED WITH USING THE SERVICES, INCLUDING THE RISK 
              OF TOTAL LOSS OF FUNDS, AND THAT YOU ARE SOLELY RESPONSIBLE FOR ANY DECISIONS YOU MAKE REGARDING THE SERVICES.
            </p>
            <p className="mb-4 leading-relaxed">
              IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT USE THE SERVICES.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

