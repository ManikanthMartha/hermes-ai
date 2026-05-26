DELETE FROM source_objects
WHERE provider = 'slack'
  AND metadata->>'connectorMode' = 'env';
