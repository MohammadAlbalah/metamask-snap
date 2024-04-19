import type {
  OnTransactionHandler,
  OnRpcRequestHandler,
  JsonRpcRequest,
  JsonRpcParams,
} from '@metamask/snaps-types';
import {
  heading,
  panel,
  text,
  copyable,
  divider,
  address,
  row,
} from '@metamask/snaps-sdk'; // Todo: Remove @metamaks/snaps-ui
import { hasProperty } from '@metamask/utils';
import {
  getHashDitResponse,
  parseTransactingValue,
  getNativeToken,
  authenticateHashDit,
  isEOA,
} from './utils/utils';
import { extractPublicKeyFromSignature } from './utils/cryptography';
import { CHAINS_INFO } from './utils/chains';

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  switch (request.method) {
    case 'publicKeyMethod':
      let publicKey = extractPublicKeyFromSignature(
        request.params.message,
        request.params.signature,
        request.params.from,
      );
      publicKey = publicKey.substring(2);

      try {
        // Save public key here and user address here:
        await snap.request({
          method: 'snap_manageState',
          params: {
            operation: 'update',
            newState: {
              publicKey: publicKey,
              userAddress: request.params.from,
              messageSignature: request.params.signature,
            },
          },
        });
      } catch (error) {
        console.log(`Error saving public key and user address: ${error}`);
      }

      try {
        const persistedData = await snap.request({
          method: 'snap_manageState',
          params: { operation: 'get' },
        });

        await authenticateHashDit(persistedData); // call HashDit API to authenticate user
      } catch (error) {
        console.log(`Error retrieving persisted data: ${error}`);
      }

      return true;

    default:
      console.log(`Method ${request.method} not defined.`);
  }
};

// Handle outgoing transactions.
export const onTransaction: OnTransactionHandler = async ({
  transaction,
  transactionOrigin,
}) => {
  // Transaction is a native token transfer if no contract bytecode found.
  if (await isEOA(transaction.to)) {
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    // Check if chainId is undefined or null
    if (typeof chainId !== 'string') {
      const contentArray: any[] = [
        heading('HashDit Security Insights'),
        text(`Error: ChainId could not be retreived (${chainId})`),
      ];
      const content = panel(contentArray);
      return { content };
    }
    // Current chain is not supported (not BSC or ETH). Display not supported text.
    if (chainId !== '0x38' && chainId !== '0x1') {
      // Retrieve saved user's public key to make HashDit API call
      const persistedUserPublicKey = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });

      let contentArray: any[] = [];
      var urlRespData;
      if (persistedUserPublicKey !== null) {
        urlRespData = await getHashDitResponse(
          'hashdit_snap_tx_api_url_detection',
          persistedUserPublicKey,
          transactionOrigin,
        );
        contentArray.push(heading('URL Risk Information'));

        if (urlRespData.url_risk >= 2) {
          contentArray.push(text(`**${urlRespData.url_risk_title}**`));
        }
        contentArray.push(
          text(
            `The URL **${transactionOrigin}** has a risk of **${urlRespData.url_risk}**`,
          ),
          divider(),
        );
      } else {
        contentArray.push(
          heading('HashDit Security Insights'),
          text('⚠️ The full functionality of HashDit is not working. ⚠️'),
          text('To resolve this issue, please follow these steps:'),
          divider(),
          text(
            "**(1)** _Click on the 'Reconnect' or 'Install' button on the HashDit website to install the Snap._",
          ),
          text(
            '**(2)** _Install the snap by approving the required permissions._',
          ),
          text(
            '**(3)** _Confirm your identity by signing the provided message._',
          ),
          divider(),
        );
      }

      const transactingValue = parseTransactingValue(transaction.value);
      const nativeToken = getNativeToken(chainId);

      contentArray.push(
        heading('Transfer Details'),
        row('Your Address', address(transaction.from)),
        row('Amount', text(`${transactingValue} ${nativeToken}`)),
        row('To', address(transaction.to)),
        divider(),
      );


      // if (CHAINS_INFO.hasOwnProperty(chainId)) {
      //   const explorerURL = CHAINS_INFO[chainId].url;
      //   contentArray.push(
      //     heading(`View Destination Address On Explorer`),
      //     copyable(`${explorerURL}${transaction.to}`),
      //     divider(),
      //   );
      // }

      contentArray.push(
        text('HashDit Security Insights is not fully supported on this chain.'),
        text(
          'Currently we only support the **BSC Mainnet** and **ETH Mainnet**.',
        ),
      );

      const content = panel(contentArray);
      return { content };
    }
    // Current chain is supported (BSC or ETH). Display token transfer insights
    else {
      // Retrieve saved user's public key to make HashDit API call
      const persistedUserPublicKey = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });

      let contentArray: any[] = [];
      var respData;
      var urlRespData;
      if (persistedUserPublicKey !== null) {
        respData = await getHashDitResponse(
          'internal_address_lables_tags',
          persistedUserPublicKey,
          transactionOrigin,
          transaction,
          chainId,
        );
        urlRespData = await getHashDitResponse(
          'hashdit_snap_tx_api_url_detection',
          persistedUserPublicKey,
          transactionOrigin,
        );

        if (respData.overall_risk_title != 'Unknown Risk') {
          contentArray = [
            heading('HashDit Transaction Screening'),
            text(`**Overall risk:** _${respData.overall_risk_title}_`),
            text(`**Risk Overview:** _${respData.overall_risk_detail}_`),
            text(`**Risk Details:** _${respData.transaction_risk_detail}_`),
            divider(),
          ];
        } else {
          contentArray = [
            heading('HashDit Transaction Screening'),
            text(`**Overall risk:** _${respData.overall_risk_title}_`),
            divider(),
          ];
        }

        contentArray.push(heading('URL Risk Information'));

        if (urlRespData.url_risk >= 2) {
          contentArray.push(text(`**${urlRespData.url_risk_title}**`));
        }
        contentArray.push(
          text(
            `The URL **${transactionOrigin}** has a risk of **${urlRespData.url_risk}**`,
          ),
          divider(),
        );
      } else {
        contentArray.push(
          heading('HashDit Security Insights'),
          text('⚠️ The full functionality of HashDit is not working. ⚠️'),
          text('To resolve this issue, please follow these steps:'),
          divider(),
          text(
            "**(1)** _Click on the 'Reconnect' or 'Install' button on the HashDit website to install the Snap._",
          ),
          text(
            '**(2)** _Install the snap by approving the required permissions._',
          ),
          text(
            '**(3)** _Confirm your identity by signing the provided message._',
          ),
          divider(),
        );
      }

      const transactingValue = parseTransactingValue(transaction.value);
      const nativeToken = getNativeToken(chainId);

      contentArray.push(
        heading('Transfer Details'),
        row('Your Address', address(transaction.from)),
        row('Amount', text(`${transactingValue} ${nativeToken}`)),
        row('To', address(transaction.to)),
        divider(),
      );

      // if (CHAINS_INFO[chainId].url) {
      //   const explorerURL = CHAINS_INFO[chainId].url;
      //   contentArray.push(
      //     heading(`View Destination Address On Explorer`),
      //     copyable(`${explorerURL}${transaction.to}`),
      //     divider(),
      //   );
      // }

      if (respData !== undefined) {
        contentArray.push(
          heading('HashDit Trace-ID'),
          text(`${respData.trace_id}`),
        );
      }

      const content = panel(contentArray);
      return { content };
    }
  }

  // Transaction is an interaction with a smart contract because contract bytecode exists.
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  // Check if chainId is undefined or null
  if (typeof chainId !== 'string') {
    const contentArray: any[] = [
      heading('HashDit Security Insights'),
      text(`Error: ChainId could not be retreived (${chainId})`),
    ];
    const content = panel(contentArray);
    return { content };
  }
  // Current chain is not BSC and not ETH. Only perform URL screening
  if (chainId !== '0x38' && chainId !== '0x1') {
    // Retrieve saved user's public key to make HashDit API call
    const persistedUserData = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    });

    let contentArray: any[] = [];
    if (persistedUserData !== null) {
      const urlRespData = await getHashDitResponse(
        'hashdit_snap_tx_api_url_detection',
        persistedUserData,
        transactionOrigin,
      );
      contentArray = [
        heading('URL Risk Information'),
        text(
          `The URL **${transactionOrigin}** has a risk of **${urlRespData.url_risk}**`,
        ),
        divider(),
        text(
          'HashDit Security Insights is not fully supported on this chain. Only URL screening has been performed.',
        ),
        text(
          'Currently we only support the **BSC Mainnet** and **ETH Mainnet**.',
        ),
      ];
    } else {
      contentArray = [
        heading('HashDit Security Insights'),
        text('⚠️ The full functionality of HashDit is not working. ⚠️'),
        text('To resolve this issue, please follow these steps:'),
        divider(),
        text(
          "**(1)** _Click on the 'Reconnect' or 'Install' button on the HashDit website to install the Snap._",
        ),
        text(
          '**(2)** _Install the snap by approving the required permissions._',
        ),
        text(
          '**(3)** _Confirm your identity by signing the provided message._',
        ),
        divider(),
        text(
          'HashDit Security Insights is not fully supported on this chain. Only URL screening has been performed.',
        ),
        text(
          'Currently we only support the **BSC Mainnet** and **ETH Mainnet**.',
        ),
      ];
    }
    const content = panel(contentArray);
    return { content };
  } else {
    // Retrieve saved user's public key to make HashDit API call
    const persistedUserPublicKey = await snap.request({
      method: 'snap_manageState',
      params: { operation: 'get' },
    });

    let contentArray: any[] = [];
    if (persistedUserPublicKey !== null) {
      const interactionRespData = await getHashDitResponse(
        'hashdit_snap_tx_api_transaction_request',
        persistedUserPublicKey,
        transactionOrigin,
        transaction,
        chainId,
      );
      const addressRespData = await getHashDitResponse(
        'internal_address_lables_tags',
        persistedUserPublicKey,
        transactionOrigin,
        transaction,
        chainId,
      );
      if (interactionRespData.overall_risk >= addressRespData.overall_risk) {
        contentArray = [
          heading('HashDit Transaction Screening'),
          text(`**Overall risk:** _${interactionRespData.overall_risk_title}_`),
          text(
            `**Risk Overview:** _${interactionRespData.overall_risk_detail}_`,
          ),
          text(
            `**Risk Details:** _${interactionRespData.transaction_risk_detail}_`,
          ),
          divider(),
        ];
      } else {
        contentArray.push(
          heading('HashDit Destination Screening'), //todo
          text(`**Overall risk:** _${addressRespData.overall_risk_title}_`),
          text(`**Risk Overview:** _${addressRespData.overall_risk_detail}_`),
          text(
            `**Risk Details:** _${addressRespData.transaction_risk_detail}_`,
          ),
          divider(),
        );
      }

      contentArray.push(heading('URL Risk Information'));

      if (interactionRespData.url_risk >= 2) {
        contentArray.push(text(`**${interactionRespData.url_risk_title}**`));
      }

      contentArray.push(
        text(
          `The URL **${transactionOrigin}** has a risk of **${interactionRespData.url_risk}**`,
        ),
        divider(),
      );

      const transactingValue = parseTransactingValue(transaction.value);
      const nativeToken = getNativeToken(chainId);

      if (transactingValue >= 0) {
        contentArray.push(
          heading('Transfer Details'),
          row('Your Address', address(transaction.from)),
          row('Amount', text(`${transactingValue} ${nativeToken}`)),
          row('To', address(transaction.to)),
          divider(),
        );
      }

      // Display function name and parameters
      if (interactionRespData.function_name !== '') {
        contentArray.push(
          heading(`Function Name: ${interactionRespData.function_name}`),
        );
        // Loop through each function parameter and display its values
        for (const param of interactionRespData.function_params) {
          contentArray.push(
            text(`**Name:** _${param.name}_`),
            text(`**Type**: _${param.type}_`),
            text(`**Value:** _${param.value}_`),
          );
        }
        contentArray.push(divider());
      }

      contentArray.push(
        heading('HashDit Trace-ID'),
        text(`${interactionRespData.trace_id}`),
      );
    } else {
      // User public key not found, display error message to snap
      contentArray = [
        heading('HashDit Security Insights'),
        text('⚠️ The full functionality of HashDit is not working. ⚠️'),
        text('To resolve this issue, please follow these steps:'),
        divider(),
        text(
          "**(1)** _Click on the 'Reconnect' or 'Install' button on the HashDit website to install the Snap._",
        ),
        text(
          '**(2)** _Install the snap by approving the required permissions._',
        ),
        text(
          '**(3)** _Confirm your identity by signing the provided message._',
        ),
      ];
    }

    const content = panel(contentArray);
    return { content };
  }
};
