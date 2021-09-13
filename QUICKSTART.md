# Quickstart with App Nodes

## Configuring your environment

In your `.env` file make sure to have the following configured:

```conf
TYPE=APP # This makes sure it's configured to be an app node
```

```conf
FILTER=app.filter.json # The path to the app filter json file
```

```conf
START_HEIGHT=764189 # The block (-1) from where your contract was deployed at
```

Make sure `START_HEIGHT` is atleast one block before where the contract was deployed.

## Creating a filter file

Your `app.filter.json` file needs to filter for both the smart contract deployment and the smart contract source. You can filter for specific ids by using the `id` key.

```json
{
    "filter": [
        {
            "id": "boJ3Fa1OU9W1NY5g1dkmgqYk5Lg_mndcdC9q64CmDPU"
        },
        {
            "id": "aZrQ9fNp1fdKqBsdZKVHFF4NZRx-icDGfAncRw4zGpY"
        }
    ]
}
```

You will also need to filter for the Contract tag with that ID. You can do so by adding a tag filter.

```json
{
    "filter": [
        {
            "name": "Contract",
            "value": "boJ3Fa1OU9W1NY5g1dkmgqYk5Lg_mndcdC9q64CmDPU"
        }
    ]
}
```

See `app.filter.dev.json` for reference of how to setup a filter file. Update the values with your smart contract info.

## Filtering additional tags

You can also filter for other tags too. Just add a new `filter` object to the filter array.

```json
{
    "filter": [
        {
            "name": "AR-Tag-Key",
            "value": "Any-Value"
        }
    ]
}
```

Adding multiple `name, value` objects to the filter acts as an `AND` operator. Creating new `filter` objects act as an `OR` operator when filtering for transactions.