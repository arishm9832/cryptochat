// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract Decentratwitter is ERC721URIStorage, Ownable {
    uint256 public tokenCount;
    uint256 public postCount;
    mapping(uint256 => Post) public posts;
    mapping(address => uint256) public profiles;

    struct Post {
        uint256 id;
        string hash;
        uint256 tipAmount;
        address payable author;
        uint256 timestamp; // Added timestamp
    }

    event PostCreated(uint256 id, string hash, uint256 tipAmount, address payable author, uint256 timestamp);
    event PostTipped(uint256 id, string hash, uint256 tipAmount, address payable author);
    event ProfileUpdated(address indexed user, uint256 indexed tokenId);

    constructor() ERC721("Cryptochat", "CHAT") {}

    function mint(string memory _tokenURI) external returns (uint256) {
        tokenCount++;
        _safeMint(msg.sender, tokenCount);
        _setTokenURI(tokenCount, _tokenURI);
        profiles[msg.sender] = tokenCount;
        emit ProfileUpdated(msg.sender, tokenCount);
        return tokenCount;
    }

    function setProfile(uint256 _id) public {
        require(ownerOf(_id) == msg.sender, "Not token owner");
        profiles[msg.sender] = _id;
        emit ProfileUpdated(msg.sender, _id);
    }

    function uploadPost(string memory _postHash) external {
        require(balanceOf(msg.sender) > 0, "Must own NFT to post");
        require(bytes(_postHash).length > 0, "Empty content");
        
        postCount++;
        posts[postCount] = Post(
            postCount,
            _postHash,
            0,
            payable(msg.sender),
            block.timestamp // Add timestamp
        );
        emit PostCreated(postCount, _postHash, 0, payable(msg.sender), block.timestamp);
    }

    function tipPostOwner(uint256 _id) external payable {
        require(_id > 0 && _id <= postCount, "Invalid post ID");
        Post storage post = posts[_id];
        require(post.author != msg.sender, "Cannot tip yourself");
        
        post.author.transfer(msg.value);
        post.tipAmount += msg.value;
        emit PostTipped(_id, post.hash, post.tipAmount, post.author);
    }

    function getAllPosts() external view returns (Post[] memory) {
        Post[] memory allPosts = new Post[](postCount);
        for (uint256 i = 0; i < postCount; i++) {
            allPosts[i] = posts[i + 1];
        }
        return allPosts;
    }

    function getMyNfts() external view returns (uint256[] memory) {
        uint256 balance = balanceOf(msg.sender);
        uint256[] memory ids = new uint256[](balance);
        uint256 index;
        for (uint256 i = 1; i <= tokenCount; i++) {
            if (ownerOf(i) == msg.sender) {
                ids[index] = i;
                index++;
            }
        }
        return ids;
    }
}
