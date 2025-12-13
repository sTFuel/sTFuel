'use client';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <section className="text-center">
        <h1 className="text-white text-4xl font-black leading-tight tracking-tighter md:text-5xl mb-4">
          Privacy Policy
        </h1>
        <p className="text-text-secondary-dark text-base font-normal leading-normal md:text-lg text-gray-color">
          Last updated: December 13, 2025
        </p>
      </section>

      {/* Content */}
      <section className="flex flex-col gap-6 text-gray-color">
        <div className="rounded-xl border border-border-dark/50 bg-card-dark p-6 sm:p-8">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-white text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="mb-4 leading-relaxed">
              This Privacy Policy ("Policy") describes how the sTFuel Protocol ("Protocol", "we", "us", or "our") collects, 
              uses, and protects information when you interact with the Protocol's smart contracts, website, and services 
              (collectively, the "Services"). By using the Services, you agree to the collection and use of information 
              in accordance with this Policy.
            </p>
            <p className="mb-4 leading-relaxed">
              This Policy is governed by Swiss law and complies with the Swiss Federal Data Protection Act (FADP) and 
              the General Data Protection Regulation (GDPR) where applicable.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">2. Information We Collect</h2>
            <h3 className="text-white text-xl font-semibold mb-3 mt-6">2.1 Blockchain Data</h3>
            <p className="mb-4 leading-relaxed">
              The Protocol operates on public blockchain networks. All transactions, wallet addresses, and interactions 
              with smart contracts are publicly visible on the blockchain. We do not control or have the ability to 
              delete this information, as it is permanently recorded on the blockchain.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Wallet addresses</li>
              <li>Transaction hashes and amounts</li>
              <li>Smart contract interactions</li>
              <li>Blockchain transaction history</li>
            </ul>

            <h3 className="text-white text-xl font-semibold mb-3 mt-6">2.2 Website Usage Data</h3>
            <p className="mb-4 leading-relaxed">
              When you visit our website, we may collect certain information automatically:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>IP addresses</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Pages visited and time spent</li>
              <li>Referral sources</li>
            </ul>

            <h3 className="text-white text-xl font-semibold mb-3 mt-6">2.3 Wallet Connection Data</h3>
            <p className="mb-4 leading-relaxed">
              When you connect your wallet to interact with the Protocol, we may access:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Public wallet addresses</li>
              <li>Token balances (read-only)</li>
              <li>Transaction signing requests (processed locally in your wallet)</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              We do not have access to your private keys, seed phrases, or any other sensitive wallet information. 
              All transactions are signed locally in your wallet and we never store or transmit private keys.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">3. How We Use Information</h2>
            <p className="mb-4 leading-relaxed">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>To provide and maintain the Services</li>
              <li>To process transactions and smart contract interactions</li>
              <li>To improve and optimize the Protocol and website</li>
              <li>To analyze usage patterns and Protocol performance</li>
              <li>To ensure security and prevent fraud</li>
              <li>To comply with legal obligations</li>
            </ul>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">4. Data Storage and Security</h2>
            <p className="mb-4 leading-relaxed">
              Blockchain data is stored on decentralized networks and cannot be deleted or modified. Website usage 
              data may be stored on servers, which we take reasonable measures to secure. However, no method of 
              transmission over the internet or electronic storage is 100% secure.
            </p>
            <p className="mb-4 leading-relaxed">
              We implement appropriate technical and organizational measures to protect your information, but we 
              cannot guarantee absolute security.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">5. Third-Party Services</h2>
            <p className="mb-4 leading-relaxed">
              The Protocol may integrate with third-party services, including:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Wallet providers (e.g., MetaMask, WalletConnect)</li>
              <li>Blockchain networks and nodes</li>
              <li>Analytics services</li>
              <li>Hosting and infrastructure providers</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              These third parties may collect information in accordance with their own privacy policies. We are not 
              responsible for the privacy practices of third-party services.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">6. Your Rights Under Swiss Law</h2>
            <p className="mb-4 leading-relaxed">
              Under Swiss data protection law, you have the following rights:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li><strong>Right to Information:</strong> You have the right to request information about the personal data we process about you.</li>
              <li><strong>Right to Rectification:</strong> You can request correction of inaccurate data.</li>
              <li><strong>Right to Erasure:</strong> (limited): You may request deletion of data, subject to legal and technical limitations (blockchain data cannot be deleted).</li>
              <li><strong>Right to Object:</strong> You can object to certain processing activities.</li>
              <li><strong>Right to Data Portability:</strong> You may request a copy of your data in a structured format.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              <strong>Important:</strong> Due to the immutable nature of blockchain technology, data recorded on the 
              blockchain cannot be deleted, modified, or rectified. We can only assist with data that is stored off-chain.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">7. Data Retention</h2>
            <p className="mb-4 leading-relaxed">
              Blockchain data is permanently stored and cannot be deleted. Off-chain data will be retained only as 
              long as necessary to fulfill the purposes outlined in this Policy, comply with legal obligations, resolve 
              disputes, and enforce our agreements.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">8. Children's Privacy</h2>
            <p className="mb-4 leading-relaxed">
              The Services are not intended for individuals under the age of 18. We do not knowingly collect personal 
              information from children. If you become aware that a child has provided us with personal information, 
              please contact us immediately.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">9. Changes to This Privacy Policy</h2>
            <p className="mb-4 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the 
              new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this 
              Privacy Policy periodically for any changes.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">10. Contact Information</h2>
            <p className="mb-4 leading-relaxed">
              If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:
            </p>
            <div className="bg-background-dark p-4 rounded-lg mb-4">
              <p className="mb-2"><strong>Node Operator:</strong></p>
              <p className="mb-2">OpenTheta AG</p>
              <p className="mb-2">Baar, Zug, Switzerland</p>
              <p className="mb-2">Email: contact@opentheta.io</p>
            </div>
            <p className="mb-4 leading-relaxed">
              For data protection inquiries, you may also contact the Swiss Federal Data Protection and Information 
              Commissioner (FDPIC) at <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener noreferrer" className="text-tfuel-color hover:underline">www.edoeb.admin.ch</a>.
            </p>

            <h2 className="text-white text-2xl font-bold mb-4 mt-8">11. Governing Law and Jurisdiction</h2>
            <p className="mb-4 leading-relaxed">
              This Privacy Policy is governed by and construed in accordance with Swiss law. Any disputes arising 
              from or in connection with this Policy shall be subject to the exclusive jurisdiction of the competent 
              courts of Zug, Switzerland.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

