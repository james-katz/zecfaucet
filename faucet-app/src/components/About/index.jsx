import './index.css';

export default function Avout() {  
  return (
    <section className="about-section snap-section">
      <div className="about-faucet">
        <h2>About zecfaucet.com</h2>
        <p>
          ZecFaucet is a tool built by the community, for the community, with the goal of introducing new users to shielded ZEC transactions, which ensure privacy through ZK-SNARKs technology. The amount received per claim is 0.0005 ZEC, and the system features an innovative anti-fraud mechanism based on Proof of Work algorithms, where the user’s browser must solve a cryptographic challenge before claiming. This challenge is dynamic, adapting to several factors while ensuring a fair experience for real users.
        </p>
        <p>
          The decision to only support unified addresses (those starting with “U”) aims to simplify the use of Zcash and encourage the adoption of private transactions — because privacy is normal!
        </p>
        <p>
          ZecFaucet is a non-profit initiative and relies on donations, which go 100% toward the faucet itself. The site’s maintenance and hosting are handled by the Zcash Brasil team.
        </p>
      </div>
      <div className="about-faucet-footer">
        <h3>zecfaucet.com is not affiliated with ECC or the Zcash Foundation.</h3>
      </div>
    </section>
  );
}
