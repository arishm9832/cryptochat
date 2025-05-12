import {
  Link,
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";
import { useState } from 'react'
import { ethers } from "ethers"
import DecentratwitterAbi from './contractsData/decentratwitter.json'
import DecentratwitterAddress from './contractsData/decentratwitter-address.json'
import { Spinner, Navbar, Nav, Button, Container, Badge } from 'react-bootstrap'
import logo from './logo.png'
import Home from './Home.js'
import Profile from './Profile.js'
import './App.css';

function App() {
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState({})

  const web3Handler = async () => {
    let accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setAccount(accounts[0])

    window.ethereum.on('chainChanged', () => {
      window.location.reload();
    })
    window.ethereum.on('accountsChanged', async () => {
      setLoading(true)
      web3Handler()
    })
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()
    loadContract(signer)
  }
  const loadContract = async (signer) => {
    const contract = new ethers.Contract(DecentratwitterAddress.address, DecentratwitterAbi.abi, signer)
    setContract(contract)
    setLoading(false)
  }

  return (
    <BrowserRouter>
      <div
        className="App"
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)",
        }}
      >
        <Navbar
          expand="lg"
          bg="dark"
          variant="dark"
          style={{
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            padding: "0.8rem 0",
            fontFamily: "Segoe UI, Arial, sans-serif",
          }}
        >
          <Container>
            <Navbar.Brand as={Link} to="/" style={{ display: "flex", alignItems: "center" }}>
              <img
                src={logo}
                width="48"
                height="48"
                alt="Logo"
                style={{
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  marginRight: "12px",
                }}
              />
              {/* Updated application name */}
              <span style={{ fontWeight: 700, fontSize: "1.5rem", letterSpacing: "1px" }}>
                Cryptochat
              </span>
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="responsive-navbar-nav" />
            <Navbar.Collapse id="responsive-navbar-nav">
              <Nav className="me-auto">
                <Nav.Link
                  as={Link}
                  to="/"
                  style={{ fontWeight: 500, fontSize: "1.1rem" }}
                  className="nav-link-hover"
                >
                  Home
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/profile"
                  style={{ fontWeight: 500, fontSize: "1.1rem" }}
                  className="nav-link-hover"
                >
                  Profile
                </Nav.Link>
              </Nav>
              <Nav>
                {account ? (
                  <Nav.Link
                    href={`https://etherscan.io/address/${account}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button nav-button btn-sm mx-2"
                  >
                    <Button
                      variant="outline-info"
                      style={{
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                        borderRadius: "20px",
                        padding: "0.4em 1.2em",
                        fontSize: "1rem",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                      }}
                    >
                      <Badge
                        bg="info"
                        text="dark"
                        style={{
                          fontSize: "0.9em",
                          marginRight: "0.6em",
                          borderRadius: "12px",
                        }}
                      >
                        Connected
                      </Badge>
                      {account.slice(0, 6) + '...' + account.slice(-4)}
                    </Button>
                  </Nav.Link>
                ) : (
                  <Button
                    onClick={web3Handler}
                    variant="info"
                    style={{
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                      borderRadius: "20px",
                      padding: "0.4em 1.2em",
                      fontSize: "1rem",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    }}
                  >
                    Connect Wallet
                  </Button>
                )}
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
        <div style={{ textAlign: "center", marginTop: "0.5rem", color: "#6c757d", fontSize: "0.98rem" }}>
         
         
          Powered by Ethereum
        </div>
        <Container style={{ marginTop: "2rem", maxWidth: "700px" }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                background: "#fff",
                borderRadius: "18px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                padding: "3rem 2rem",
              }}
            >
              <Spinner animation="border" variant="info" style={{ width: 60, height: 60, marginBottom: "1.5rem" }} />
              <h4 style={{ color: "#1e293b", fontWeight: 700, marginBottom: "0.5rem" }}>
                Awaiting Metamask Connection...
              </h4>
              <p style={{ color: "#64748b", fontSize: "1.1rem" }}>
                Please connect your wallet to continue using Cryptochat.
              </p>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Home contract={contract} />} />
              <Route path="/profile" element={<Profile contract={contract} />} />
            </Routes>
          )}
        </Container>
        <footer style={{
          textAlign: "center",
          color: "#a0aec0",
          fontSize: "0.95rem",
          marginTop: "2rem",
          paddingBottom: "1.2rem",
          letterSpacing: "0.2px"
        }}>
          &copy; {new Date().getFullYear()} Cryptochat &mdash; A DappUniversity Project
        </footer>
        <style>{`
          .nav-link-hover:hover {
            color: #38bdf8 !important;
            text-decoration: underline;
            background: rgba(56,189,248,0.07);
            border-radius: 8px;
            transition: all 0.2s;
          }
        `}</style>
      </div>
    </BrowserRouter>
  );
}

export default App;
