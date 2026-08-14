import { Text, XStack, YStack } from 'tamagui';

type FormattedJsonProps = {
  value: unknown;
};

export function FormattedJson({ value }: FormattedJsonProps) {
  return (
    <YStack
      background="$color3"
      rounded="$4"
      p="$3"
      gap="$1"
      borderWidth={1}
      borderColor="$color5"
    >
      <JsonNode value={value} depth={0} />
    </YStack>
  );
}

function JsonNode({
  value,
  depth,
  name,
}: {
  value: unknown;
  depth: number;
  name?: string;
}) {
  const pad = depth * 12;

  if (value === null) {
    return <JsonLine pad={pad} name={name} text="null" tone="keyword" />;
  }

  if (typeof value === 'string') {
    return (
      <JsonLine
        pad={pad}
        name={name}
        text={JSON.stringify(value)}
        tone="string"
      />
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return (
      <JsonLine pad={pad} name={name} text={String(value)} tone="keyword" />
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <JsonLine pad={pad} name={name} text="[]" tone="plain" />;
    }
    return (
      <YStack>
        <JsonLine pad={pad} name={name} text="[" tone="plain" />
        {value.map((item, index) => (
          <JsonNode
            key={`${depth}-${index}`}
            value={item}
            depth={depth + 1}
            name={String(index)}
          />
        ))}
        <JsonLine pad={pad} text="]" tone="plain" />
      </YStack>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <JsonLine pad={pad} name={name} text="{}" tone="plain" />;
    }
    return (
      <YStack>
        <JsonLine pad={pad} name={name} text="{" tone="plain" />
        {entries.map(([key, nested]) => (
          <JsonNode
            key={`${depth}-${key}`}
            value={nested}
            depth={depth + 1}
            name={key}
          />
        ))}
        <JsonLine pad={pad} text="}" tone="plain" />
      </YStack>
    );
  }

  return <JsonLine pad={pad} name={name} text={String(value)} tone="plain" />;
}

function JsonLine({
  pad,
  name,
  text,
  tone,
}: {
  pad: number;
  name?: string;
  text: string;
  tone: 'plain' | 'string' | 'keyword';
}) {
  const valueColor =
    tone === 'string'
      ? '$green11'
      : tone === 'keyword'
        ? '$green10'
        : '$color12';

  return (
    <XStack pl={pad} flexWrap="wrap" items="flex-start">
      {name !== undefined ? (
        <Text fontFamily="$body" fontSize="$2" color="$color10">
          {name}:{' '}
        </Text>
      ) : null}
      <Text fontFamily="$body" fontSize="$2" color={valueColor}>
        {text}
      </Text>
    </XStack>
  );
}
