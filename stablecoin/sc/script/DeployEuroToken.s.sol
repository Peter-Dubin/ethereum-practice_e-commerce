// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {EuroToken} from "../src/EuroToken.sol";

/// @notice Deployment script for EuroToken
contract DeployEuroToken is Script {
    function run() external {
        // Get the deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Deploy the EuroToken contract
        vm.startBroadcast(deployerPrivateKey);
        
        EuroToken euroToken = new EuroToken(msg.sender);
        
        vm.stopBroadcast();
        
        // Log the deployed address
        console2.log("EuroToken deployed to:", address(euroToken));
        console2.log("Token name:", euroToken.name());
        console2.log("Token symbol:", euroToken.symbol());
        console2.log("Total supply:", euroToken.totalSupply());
        console2.log("Decimals:", euroToken.decimals());
    }
}
