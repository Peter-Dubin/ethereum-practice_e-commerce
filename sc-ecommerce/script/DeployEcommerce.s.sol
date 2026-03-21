// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Ecommerce} from "../src/Ecommerce.sol";

/// @notice Deployment script for Ecommerce contract
contract DeployEcommerce is Script {
    function run() external {
        // Get the deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get EuroToken address from environment
        address euroTokenAddress = vm.envAddress("EUROTOKEN_ADDRESS");
        
        // Deploy the Ecommerce contract
        vm.startBroadcast(deployerPrivateKey);
        
        Ecommerce ecommerce = new Ecommerce(euroTokenAddress);
        
        vm.stopBroadcast();
        
        // Log the deployed address
        console2.log("Ecommerce deployed to:", address(ecommerce));
        console2.log("EuroToken address:", euroTokenAddress);
    }
}
