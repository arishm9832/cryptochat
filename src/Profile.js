import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Container, Spinner, Form, Row, Col, Alert } from 'react-bootstrap';
import axios from 'axios';
import { FiUser } from 'react-icons/fi';

const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2ZDMzOGVkMS1mM2EwLTQwNGMtYjA4ZS00MmI2MWFhMzY0YzEiLCJlbWFpbCI6ImtzaGl0aWprdW1yZTFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjIzMmZjYzQwNDJiODc0NzJiZWRlIiwic2NvcGVkS2V5U2VjcmV0IjoiOWIxYTI0YTkxNWNiMDcxNGQyODFmYzNlM2VjNzlhNzEwYTJmYzYzNGE1YTBhZGYzNGI0MGU4ZDFjY2Q2YTM1MyIsImV4cCI6MTc3ODM0ODMzOH0.5YDfAKmZY8WWDvR0r5REMuBk00Q8Ne-ZQOd-T7fT0zE";
const PINATA_FILE_UPLOAD = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_UPLOAD = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

const Profile = ({ contract }) => {
    const [profile, setProfile] = useState(null);
    const [nfts, setNfts] = useState([]);
    const [avatar, setAvatar] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [isMinting, setIsMinting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleActivateProfile = useCallback(async (nft) => {
        try {
            setLoading(true);
            setError('');
            const tx = await contract.setProfile(nft.id);
            await tx.wait();
            await loadMyNFTs(); // Refresh the NFT list
            navigate('/'); // Redirect to home page
        } catch (err) {
            setError('Failed to activate profile: ' + (err.reason || err.message));
            console.error('Activation Error:', err);
        } finally {
            setLoading(false);
        }
    }, [contract, navigate]);

    const uploadToIPFS = async (event) => {
        event.preventDefault();
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const metadata = JSON.stringify({ name: `Avatar-${Date.now()}` });
            formData.append('pinataMetadata', metadata);

            const options = JSON.stringify({ cidVersion: 1 });
            formData.append('pinataOptions', options);

            const { data } = await axios.post(PINATA_FILE_UPLOAD, formData, {
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setAvatar(`${IPFS_GATEWAY}${data.IpfsHash}`);
        } catch (err) {
            setError('Image upload failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    const mintProfile = async () => {
        if (!avatar || !username) {
            setError('Please provide both username and profile image');
            return;
        }

        setIsMinting(true);
        setError('');

        try {
            const metadata = {
                name: username,
                description: "Cryptochat Profile NFT",
                image: avatar.replace(IPFS_GATEWAY, 'ipfs://'),
                attributes: [{
                    trait_type: "Created",
                    value: new Date().toISOString()
                }]
            };

            const { data } = await axios.post(PINATA_JSON_UPLOAD, {
                pinataContent: metadata,
                pinataMetadata: { name: `${username}-metadata.json` }
            }, {
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`,
                    'Content-Type': 'application/json'
                }
            });

            const tx = await contract.mint(`ipfs://${data.IpfsHash}`);
            await tx.wait();
            await loadMyNFTs();
            setUsername('');
            setAvatar('');
        } catch (err) {
            setError('Minting failed: ' + (err.reason || err.message));
        } finally {
            setIsMinting(false);
        }
    };

    const loadMyNFTs = useCallback(async () => {
        setLoading(true);
        try {
            const results = await contract.getMyNfts();
            const items = await Promise.all(
                results.map(async (tokenId) => {
                    try {
                        const uri = await contract.tokenURI(tokenId);
                        const res = await fetch(uri.replace('ipfs://', IPFS_GATEWAY));
                        const meta = await res.json();
                        return {
                            id: tokenId,
                            username: meta.name,
                            avatar: meta.image.replace('ipfs://', IPFS_GATEWAY)
                        };
                    } catch (err) {
                        console.error('Error loading NFT:', err);
                        return null;
                    }
                })
            );
            setNfts(items.filter(Boolean));
            await getActiveProfile(items);
        } catch (err) {
            setError('Failed to load NFTs: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [contract]);

    const getActiveProfile = useCallback(async (nfts) => {
        try {
            const address = await contract.signer.getAddress();
            const activeId = await contract.profiles(address);
            const activeProfile = nfts.find(nft => nft?.id === activeId);
            setProfile(activeProfile);
        } catch (err) {
            console.error('Profile Error:', err);
        }
    }, [contract]);

    useEffect(() => {
        if (contract) {
            loadMyNFTs();
        }
    }, [contract, loadMyNFTs]);

    return (
        <Container className="py-5">
            <h2 className="text-center mb-4">Profile Settings</h2>
            {error && <Alert variant="danger" className="text-center">{error}</Alert>}

            {profile ? (
                <Card className="mb-5 shadow-lg text-center">
                    <Card.Img
                        variant="top"
                        src={profile.avatar}
                        style={{ height: '200px', objectFit: 'cover' }}
                        onError={(e) => e.target.src = '/default-avatar.png'}
                    />
                    <Card.Body>
                        <Card.Title>{profile.username}</Card.Title>
                        <Card.Text>NFT ID: {profile.id.toString()}</Card.Text>
                    </Card.Body>
                </Card>
            ) : (
                <Card className="mb-5 shadow-lg text-center">
                    <Card.Body>
                        <FiUser size={48} className="mb-3" />
                        <Card.Text>No active profile selected</Card.Text>
                    </Card.Body>
                </Card>
            )}

            <Card className="mb-5 shadow-sm">
                <Card.Body>
                    <h4 className="mb-4">Create New Profile</h4>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Profile Image</Form.Label>
                            <Form.Control 
                                type="file" 
                                onChange={uploadToIPFS} 
                                disabled={isUploading}
                            />
                            {isUploading && <Spinner size="sm" className="ms-2" />}
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label>Username</Form.Label>
                            <Form.Control
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                maxLength={32}
                            />
                        </Form.Group>

                        <Button 
                            variant="primary" 
                            onClick={mintProfile}
                            disabled={isMinting || !avatar || !username}
                        >
                            {isMinting ? (
                                <>
                                    <Spinner size="sm" className="me-2" />
                                    Minting...
                                </>
                            ) : 'Mint Profile'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>

            <h4 className="mb-4">Your NFT Collection</h4>
            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            ) : (
                <div className="row row-cols-1 row-cols-md-3 g-4">
                    {nfts.map((nft) => (
                        <div key={nft.id.toString()} className="col">
                            <Card className="h-100 shadow-sm">
                                <Card.Img
                                    variant="top"
                                    src={nft.avatar}
                                    style={{ height: '200px', objectFit: 'cover' }}
                                    onError={(e) => e.target.src = '/default-avatar.png'}
                                />
                                <Card.Body className="d-flex flex-column">
                                    <Card.Title>{nft.username}</Card.Title>
                                    <Button 
                                        variant="outline-primary" 
                                        onClick={() => handleActivateProfile(nft)}
                                        className="mt-auto"
                                        disabled={loading}
                                    >
                                        {loading ? <Spinner size="sm" /> : 'Activate Profile'}
                                    </Button>
                                </Card.Body>
                            </Card>
                        </div>
                    ))}
                </div>
            )}
        </Container>
    );
};

export default Profile;
