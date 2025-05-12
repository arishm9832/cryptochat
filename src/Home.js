import { useState, useEffect, useCallback } from 'react';
import { ethers } from "ethers";
import { Form, Button, Card, Spinner, Container } from 'react-bootstrap';
import axios from 'axios';
import { FiSend, FiDollarSign, FiUser, FiImage } from 'react-icons/fi';
import TimeAgo from 'react-timeago';

const PINATA_API_KEY = 'ec7fa84070e4cb5bca86';
const PINATA_SECRET_KEY = '68e60baa07dc6aa94b2a80294f577411e629be0f1915115a14b1442ae68b3bc8';
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

const Home = ({ contract }) => {
    const [posts, setPosts] = useState([]);
    const [hasProfile, setHasProfile] = useState(false);
    const [postContent, setPostContent] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [imageFile, setImageFile] = useState(null);

    const loadPosts = useCallback(async () => {
        try {
            const address = await contract.signer.getAddress();
            setAddress(address);
            const balance = await contract.balanceOf(address);
            setHasProfile(balance.gt(0));

            const results = await contract.getAllPosts();
            const processedPosts = await Promise.all(
                results.map(async (post) => {
                    try {
                        // Fetch post metadata from IPFS
                        const postRes = await fetch(`${IPFS_GATEWAY}${post.hash}`);
                        if (!postRes.ok) throw new Error('Failed to fetch post metadata');
                        const postData = await postRes.json();

                        // Fetch author profile data
                        let profileData = {
                            username: "Anonymous",
                            avatar: "/default-avatar.png"
                        };
                        try {
                            const profileId = await contract.profiles(post.author);
                            if (profileId.gt(0)) {
                                const profileURI = await contract.tokenURI(profileId);
                                const profileRes = await fetch(profileURI);
                                if (profileRes.ok) {
                                    profileData = await profileRes.json();
                                }
                            }
                        } catch (profileError) {
                            console.warn("Error loading profile:", profileError);
                        }

                        return {
                            id: post.id.toNumber(),
                            content: postData.content || "",
                            image: postData.image || "",
                            tipAmount: post.tipAmount.toString(),
                            timestamp: post.timestamp.toNumber() * 1000,
                            author: {
                                address: post.author,
                                username: profileData.username || profileData.name || "Anonymous",
                                avatar: profileData.avatar || profileData.image || "/default-avatar.png"
                            }
                        };
                    } catch (error) {
                        console.error("Error processing post:", error);
                        return null;
                    }
                })
            );

            // Filter out failed posts and sort
            const validPosts = processedPosts.filter(post => post !== null)
                .sort((a, b) => Number(b.tipAmount) - Number(a.tipAmount));
            
            setPosts(validPosts);
            setLoading(false);
        } catch (error) {
            console.error("Error loading posts:", error);
            setLoading(false);
        }
    }, [contract]);

    useEffect(() => {
        if (contract) loadPosts();
    }, [contract, loadPosts]);

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) setImageFile(file);
    };

    const uploadPost = async () => {
        if (!postContent && !imageFile) return;
        setIsUploading(true);

        try {
            // Prepare post metadata
            const postMetadata = { content: postContent };
            
            // Upload image if present
            if (imageFile) {
                const imageForm = new FormData();
                imageForm.append('file', imageFile);
                const { data: imageRes } = await axios.post(
                    'https://api.pinata.cloud/pinning/pinFileToIPFS',
                    imageForm,
                    {
                        headers: {
                            pinata_api_key: PINATA_API_KEY,
                            pinata_secret_api_key: PINATA_SECRET_KEY,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
                postMetadata.image = imageRes.IpfsHash;
            }

            // Upload post metadata
            const metadataBlob = new Blob([JSON.stringify(postMetadata)], { type: 'application/json' });
            const metadataForm = new FormData();
            metadataForm.append('file', metadataBlob, 'post.json');
            
            const { data: metadataRes } = await axios.post(
                'https://api.pinata.cloud/pinning/pinFileToIPFS',
                metadataForm,
                {
                    headers: {
                        pinata_api_key: PINATA_API_KEY,
                        pinata_secret_api_key: PINATA_SECRET_KEY,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            // Submit to blockchain
            const tx = await contract.uploadPost(metadataRes.IpfsHash);
            await tx.wait();
            
            // Reset form and reload posts
            setPostContent('');
            setImageFile(null);
            await loadPosts();
        } catch (error) {
            console.error('Post creation failed:', error);
            alert(`Error: ${error.response?.data?.error || error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const tipPost = async (postId) => {
        try {
            const tx = await contract.tipPostOwner(postId, {
                value: ethers.utils.parseEther("0.1")
            });
            await tx.wait();
            await loadPosts();
        } catch (error) {
            console.error("Tipping failed:", error);
            alert(`Error: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <Container className="py-4">
            {hasProfile && (
                <Card className="mb-4 shadow-sm">
                    <Card.Body>
                        <div className="d-flex gap-3 align-items-start">
                            <div className="avatar-circle">
                                <FiUser className="avatar-icon" />
                            </div>
                            <div className="flex-grow-1">
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    placeholder="Share your thoughts with the Web3 community..."
                                    value={postContent}
                                    onChange={(e) => setPostContent(e.target.value)}
                                    className="mb-3"
                                />
                                <div className="d-flex justify-content-between align-items-center">
                                    <Form.Label className="m-0" style={{ cursor: 'pointer' }}>
                                        <input
                                            type="file"
                                            id="imageUpload"
                                            accept="image/*"
                                            hidden
                                            onChange={handleImageUpload}
                                        />
                                        <FiImage size={24} className="text-primary" />
                                    </Form.Label>
                                    <div className="d-flex align-items-center gap-2">
                                        {imageFile && (
                                            <small className="text-muted">
                                                {imageFile.name}
                                            </small>
                                        )}
                                        <Button 
                                            variant="primary" 
                                            onClick={uploadPost}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? (
                                                <Spinner animation="border" size="sm" />
                                            ) : (
                                                <>
                                                    <FiSend className="me-2" />
                                                    Post
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card.Body>
                </Card>
            )}

            <div className="posts-feed">
                {posts.length > 0 ? (
                    posts.map((post) => (
                        <Card key={post.id} className="mb-3 shadow-sm">
                            <Card.Body>
                                <div className="d-flex gap-3 align-items-start">
                                    <img
                                        src={post.author.avatar}
                                        alt="avatar"
                                        className="avatar-circle"
                                        onError={(e) => e.target.src = '/default-avatar.png'}
                                    />
                                    <div className="flex-grow-1">
                                        <div className="d-flex align-items-center mb-2">
                                            <h6 className="mb-0 me-2">{post.author.username}</h6>
                                            <small className="text-muted">
                                                @{post.author.address.slice(0, 6)}...{post.author.address.slice(-4)}
                                            </small>
                                            <small className="text-muted ms-2">
                                                <TimeAgo date={post.timestamp} />
                                            </small>
                                        </div>
                                        
                                        {post.content && <p className="mb-3">{post.content}</p>}
                                        
                                        {post.image && (
                                            <img 
                                                src={`${IPFS_GATEWAY}${post.image}`}
                                                alt="Post content"
                                                className="img-fluid rounded mb-3"
                                            />
                                        )}

                                        <div className="d-flex align-items-center justify-content-between">
                                            <Button 
                                                variant="outline-primary" 
                                                onClick={() => tipPost(post.id)}
                                                disabled={address === post.author.address}
                                            >
                                                <FiDollarSign className="me-2" />
                                                Tip 0.1 ETH
                                            </Button>
                                            <div className="text-muted">
                                                Total Tips: {ethers.utils.formatEther(post.tipAmount)} ETH
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-5">
                        <FiSend size={40} className="mb-3 text-muted" />
                        <h4>No posts yet</h4>
                        <p className="text-muted">Start the conversation!</p>
                    </div>
                )}
            </div>
        </Container>
    );
};

export default Home;
