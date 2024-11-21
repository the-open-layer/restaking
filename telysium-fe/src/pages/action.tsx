import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Link, useParams } from 'react-router-dom';
import TonscanIcon from '@/assets/images/icon/tonscan.svg?react';
import { useAccount } from '@/hooks/useAccount';
import useTonPrice from '@/hooks/api/useTonPrice';
import Big from 'big.js';
import { HelpCircle } from 'lucide-react';
import { DepositStateEnum } from '@/types/action';
import DepositModal from '@/components/ux/modals/deposit';
import { Navigate } from 'react-router-dom';
import { ACTION_TYPES, ACTION_TYPES_LIST } from '@/constant';
import { useStakeList } from '@/hooks/api/useStakeList';
import { getStakeTx, getUnstakeTx } from '@/lib/stake';
import { useBalance } from '@/hooks/useBalance';
import { ACTION_TYPES_TITLE_MAP } from '@/constant';
import { fromNano } from '@ton/ton';
import { getTxResult } from '@/lib/address';
import { useUserRestaking } from '@/hooks/useUserRestaking';

export default function Action() {
  const { action, token } = useParams();
  const { data: stakeList = [] } = useStakeList();
  const { connected, tonConnectUI, rawAddress } = useAccount();
  const [amount, setAmount] = useState('');
  const { data: tonPrice } = useTonPrice();
  const [depositState, setDepositState] = useState<DepositStateEnum>(
    DepositStateEnum.IDLE
  );
  const { data: restakingInfo, isLoading: useStakingLoading } =
    useUserRestaking();
  const restakeToken = stakeList.find((v) => v.symbol === token);
  const { data: tokenAmount } = useBalance(restakeToken!.address);
  const getTx = useMemo(() => {
    if (action === ACTION_TYPES.DEPOSIT) {
      return getStakeTx;
    } else if (action === ACTION_TYPES.UNSTAKE) {
      return getUnstakeTx;
    }
    return getUnstakeTx;
  }, [action]);
  const maxAmount = useMemo(() => {
    if (action === ACTION_TYPES.DEPOSIT) {
      return Big(fromNano(tokenAmount ?? 0).toString()).toFixed(2);
    } else {
      // action === ACTION_TYPES.UNSTAKE
      return restakingInfo?.restakeAmount.toFixed(2);
    }
  }, [action, tokenAmount]);
  const handleSubmit = async () => {
    setDepositState(DepositStateEnum.CONFIRMING);
    try {
      const result = await tonConnectUI.sendTransaction(
        await getTx(amount, rawAddress, restakeToken!.address),
        {
          modals: 'all',
        }
      );
      const res = await getTxResult(result.boc);
      console.log('res', res);
      setDepositState(DepositStateEnum.SUCCESS);
    } catch (error) {
      console.error('Transaction failed', error);
      setDepositState(DepositStateEnum.ERROR);
    }
  };

  const handleTryAgain = () => {
    setDepositState(DepositStateEnum.CONFIRMING);
  };

  const handleClose = () => {
    setDepositState(DepositStateEnum.IDLE);
  };
  if (
    !ACTION_TYPES_LIST.includes(action as ACTION_TYPES) ||
    !stakeList.some((v) => v.symbol === token)
  ) {
    return <Navigate to="/404" />;
  }
  const { DepositList } = useMemo(() => {
    let DepositList: Array<{ text: string; value: JSX.Element }> = [];
    DepositList = [
      {
        text:
          action === ACTION_TYPES.DEPOSIT
            ? 'Available to stake'
            : 'Available to unstake',
        value: (
          <div>
            {maxAmount} {token}
          </div>
        ),
      },
    ];

    return {
      DepositList: DepositList,
    };
  }, [tonPrice, amount, maxAmount, action]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {ACTION_TYPES_TITLE_MAP[action as ACTION_TYPES]}
      </h1>
      <Card className="mb-8">
        <CardHeader className="flex flex-row justify-between items-center space-y-0 ">
          <Link
            to={`/restake/${token}`}
            className="flex items-center gap-x-4 hover:-translate-y-0.5"
          >
            <img
              src={restakeToken?.image}
              alt={restakeToken?.name}
              className="size-10"
            />
            <div>
              <CardTitle className="text-xl">{restakeToken?.name}</CardTitle>
              <CardDescription>{restakeToken?.symbol}</CardDescription>
            </div>
          </Link>
          <a
            href={
              restakeToken?.testnet
                ? `https://testnet.tonscan.org/${restakeToken?.address}`
                : `https://tonscan.org/address/${restakeToken?.address}`
            }
            target="_blank"
          >
            <TonscanIcon className="text-8 cursor-pointer" />
          </a>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 pt-5">
            <div className="flex flex-col">
              <div className="flex justify-between gap-x-2 items-center">
                <div className="flex items-end gap-x-2 max-w-80">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                    }}
                    step={0.1}
                    placeholder="0.0000"
                    className="text-6xl h-20"
                  />
                  <span className="text-base text-muted-foreground ">
                    {restakeToken?.symbol}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  className="px-3 py-1 leading-none rounded-2xl text-sm font-medium h-7"
                  onClick={() => {
                    if (connected) {
                      setAmount(maxAmount!);
                    } else {
                      tonConnectUI.openModal();
                    }
                  }}
                  disabled={Number(maxAmount) === 0}
                >
                  MAX
                </Button>
              </div>
            </div>
            {/* <span className="text-sm text-muted-foreground">${USDTPrice}</span> */}

            {connected ? (
              <Button
                className="w-full rounded-2xl"
                size="lg"
                onClick={handleSubmit}
                disabled={
                  Big(amount || 0).lte(0) ||
                  Big(amount || 0)
                    .minus(maxAmount ?? 0)
                    .gt(0) ||
                  Big(maxAmount || 0).lte(0)
                }
              >
                Submit
              </Button>
            ) : (
              <Button
                className="w-full border-black rounded-2xl"
                variant="outline"
                size="lg"
                onClick={() => {
                  tonConnectUI.openModal();
                }}
              >
                Connect Wallet to Deposit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {DepositList.length > 0 && (
        <Card className="bg-transparent shadow-none">
          <CardContent className="flex flex-col gap-y-4">
            {DepositList.map(({ text, value }, idx) => {
              return (
                <div className="flex justify-between" key={idx}>
                  <span className="text-secondary-foreground">{text}</span>
                  <span className="text-[#666666]">{value}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <DepositModal
        amount={amount}
        status={depositState}
        handleClose={handleClose}
        handleTryAgain={handleTryAgain}
      />
    </div>
  );
}
